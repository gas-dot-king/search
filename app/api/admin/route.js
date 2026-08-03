import crypto from "node:crypto";
import {
  sb,
  photoCleanupStatus,
  processPhotoCleanup,
  schedulePhotoCleanup,
  signedUrls,
  thumbPathFor,
} from "@/lib/db";
import { hashPin, hashToken, newToken, sessionExpiresAt } from "@/lib/auth";
import { route, requireAdmin, readJson, ApiError, requireDbSuccess } from "@/lib/api";
import { adminSessionCookie, clearAdminSessionCookie, verifyAdminPassword } from "@/lib/adminAuth";
import { takeRateLimit } from "@/lib/rateLimit";
import { decodeRecentCursor, encodeRecentCursor } from "@/lib/adminCursor";
import { lottoRoundState, photoUrlLookup, lottoEntriesFor } from "@/lib/adminData";
import { getSettings, invalidateSettingsCache, editableSettings, EDITABLE_KEYS } from "@/lib/settings";
import { buildEventStats } from "@/lib/stats";
import { getAllProgress, invalidateBingoHallCache } from "@/lib/progress";
import { serializeEventGuide } from "@/lib/event";
import { fourLineAchievements, mergeFourLineAwards } from "@/lib/hall";
import { normalizeRecoveryEvent, recoveryState, RECOVERY_STATES, recoveryTicketDigit, recoveryTicketLabel, serializeRecoveryEvent } from "@/lib/recovery";
import { demoAdminAction } from "@/lib/demoAdmin";
import {
  currentLottoRound,
  serializeLottoRounds,
  LOTTO_DRAW_DIGITS,
} from "@/lib/lotto";
import {
  demoAdminUser,
  demoFourLineRanking,
  demoItems,
  demoLottoRound,
  demoProgress,
  demoRecentUploads,
  demoRecoveryAdmin,
  demoSettings,
  isDemoMode,
} from "@/lib/demo";

/** 검토 큐 한 페이지 크기. 관리자가 행사장에서 폰으로 넘겨보는 양을 기준으로 잡았다. */
const RECENT_PAGE_SIZE = 30;

export const GET = route(async (req) => {
  await requireAdmin(req);
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "overview";

  if (isDemoMode()) {
    if (action === "overview") {
      const progress = demoProgress();
      return {
        settings: demoSettings(),
        users: progress.progress,
        items: demoItems(),
        fourLine: demoFourLineRanking(),
        cleanup: { pending: 0, stuck: 0, oldest: null, samples: [] },
        stats: buildEventStats({
          progress: progress.progress,
          cells: (progress.cells || []).filter((cell) => cell.photo_path),
          lotto: progress.lotto || [],
          allCells: progress.cells || [],
          items: demoItems(),
        }),
      };
    }
    if (action === "user") return demoAdminUser(url.searchParams.get("id"));
    if (action === "lotto_round") return demoLottoRound();
    if (action === "recovery") return demoRecoveryAdmin();
    if (action === "recent") {
      return demoRecentUploads(url.searchParams.get("before"), RECENT_PAGE_SIZE);
    }
    throw new ApiError("알 수 없는 요청입니다.");
  }

  // 전 회원의 인증 사진을 올라온 순서대로. 회원을 한 명씩 열어보지 않고도
  // "새로 올라온 것"만 훑을 수 있어야 매일의 검토가 회원 수에 끌려가지 않는다.
  if (action === "recent") {
    const before = url.searchParams.get("before");
    let query = sb()
      .from("cells")
      .select("id, user_id, position, photo_path, uploaded_at, photo_meta, users ( nickname ), bingo_items ( content, category )")
      .not("photo_path", "is", null)
      .order("uploaded_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(RECENT_PAGE_SIZE + 1); // 한 건 더 읽어 "더 있는지"를 판단한다
    const cursor = decodeRecentCursor(before);
    if (cursor?.id) {
      query = query.or(`uploaded_at.lt.${cursor.at},and(uploaded_at.eq.${cursor.at},id.lt.${cursor.id})`);
    } else if (cursor?.at) {
      query = query.lt("uploaded_at", cursor.at);
    }

    const { data, error } = await query;
    requireDbSuccess(error, "최근 인증을 불러오지 못했습니다");

    const rows = data || [];
    const hasMore = rows.length > RECENT_PAGE_SIZE;
    const page = hasMore ? rows.slice(0, RECENT_PAGE_SIZE) : rows;
    const urlsOf = await photoUrlLookup(page.map((row) => row.photo_path));

    return Response.json(
      {
        uploads: page.map((row) => ({
          id: row.id,
          userId: row.user_id,
          nickname: row.users?.nickname || "?",
          position: row.position,
          content: row.bingo_items?.content || "",
          category: row.bingo_items?.category || 0,
          uploadedAt: row.uploaded_at,
          photoMeta: row.photo_meta || null,
          ...urlsOf(row.photo_path),
        })),
        nextCursor: hasMore ? encodeRecentCursor(page[page.length - 1]) : null,
      },
      { headers: { "Cache-Control": "no-store", "Vary": "Cookie" } }
    );
  }

  if (action === "lotto_round") {
    return Response.json(await lottoRoundState(await getSettings()), {
      headers: { "Cache-Control": "no-store", "Vary": "Cookie" },
    });
  }

  if (action === "recovery") {
    const settings = await getSettings();
    const event = normalizeRecoveryEvent(settings.recovery_event);
    const { data, error } = await sb()
      .from("recovery_entries")
      .select("ticket_no, user_id, note, created_at, photo_path, users ( nickname )")
      .eq("event_key", event.key)
      .order("created_at");
    requireDbSuccess(error, "복구 인증 목록을 불러오지 못했습니다");
    return Response.json({
      event,
      state: recoveryState(event),
      entries: (data || []).map((row) => ({
        ticketNo: row.ticket_no,
        ticket: recoveryTicketLabel(row.ticket_no),
        digit: recoveryTicketDigit(row.ticket_no),
        userId: row.user_id,
        nickname: row.users?.nickname || "?",
        note: row.note || "",
        createdAt: row.created_at,
        photoPath: row.photo_path,
      })),
    }, { headers: { "Cache-Control": "no-store", "Vary": "Cookie" } });
  }

  if (action === "overview") {
    const [
      settings,
      { progress, cells, allCells, lotto },
      { data: items, error: itemsError },
      { data: awards, error: awardsError },
      cleanup,
    ] = await Promise.all([
      getSettings(),
      getAllProgress({ includeAllCells: true }),
      sb().from("bingo_items").select("id, category, content").order("category").order("id"),
      sb().from("four_line_awards").select("user_id, achieved_at, confirmed_at").order("achieved_at"),
      photoCleanupStatus(),
    ]);
    requireDbSuccess(itemsError, "빙고 항목을 불러오지 못했습니다");
    // 확정 명단은 부가 기능이다. 표가 아직 없어도(마이그레이션 전 배포) 관리자 화면 전체가
    // 죽으면 안 되므로, 못 읽으면 "확정된 사람이 없는" 상태로 본다.
    if (awardsError) console.error("[admin] four_line_awards not read", awardsError);

    // 선물이 걸린 4줄 선착순은 운영진이 인증 사진을 직접 확인해야 하므로 회원 id까지 함께 준다.
    const nicknameOf = new Map(progress.map((user) => [user.id, user.nickname]));
    const fourLine = mergeFourLineAwards(
      fourLineAchievements(cells),
      (awards || []).map((award) => ({
        userId: award.user_id,
        achievedAt: award.achieved_at,
        confirmedAt: award.confirmed_at,
      }))
    ).map((row) => ({ ...row, id: row.userId, nickname: nicknameOf.get(row.userId) || "?" }));

    return Response.json(
      {
        settings: editableSettings(settings),
        users: progress,
        items: items || [],
        fourLine,
        cleanup,
        stats: buildEventStats({ progress, cells, lotto, allCells, items: items || [] }),
      },
      { headers: { "Cache-Control": "no-store", "Vary": "Cookie" } }
    );
  }

  if (action === "user") {
    const userId = url.searchParams.get("id");
    const [{ data: cells, error: cellsError }, { data: entries, error: entriesError }] = await Promise.all([
      sb()
        .from("cells")
        .select("id, position, photo_path, uploaded_at, photo_meta, bingo_items ( content, category )")
        .eq("user_id", userId)
        .order("position"),
      lottoEntriesFor(userId),
    ]);
    requireDbSuccess(cellsError || entriesError, "회원 인증 정보를 불러오지 못했습니다");

    // 그리드는 축소본으로 그린다. 원본 16장이면 4MB가 넘어, 행사장에서 회원을
    // 한 명씩 열어볼 때마다 그만큼을 다시 받게 된다. 원본은 눌렀을 때만 연다.
    const urlsOf = await photoUrlLookup([
      ...(cells || []).map((c) => c.photo_path),
      ...(entries || []).map((e) => e.photo_path),
    ]);

    return {
      cells: (cells || []).map((c) => ({
        id: c.id,
        position: c.position,
        content: c.bingo_items?.content || "",
        category: c.bingo_items?.category || 0,
        uploadedAt: c.uploaded_at,
        photoMeta: c.photo_meta || null,
        ...urlsOf(c.photo_path),
      })),
      lotto: (entries || []).map((e) => ({
        id: e.id,
        digits: e.digits,
        createdAt: e.created_at,
        photoMeta: e.photo_meta || null,
        ...urlsOf(e.photo_path),
      })),
    };
  }

  throw new ApiError("알 수 없는 요청입니다.");
});

export const POST = route(async (req) => {
  const body = await readJson(req);

  if (body.action === "login") {
    const allowed = await takeRateLimit(req, "admin-login", "admin", { limit: 10, windowSeconds: 15 * 60 });
    if (!allowed) throw new ApiError("관리자 인증 요청이 너무 많습니다. 잠시 뒤 다시 시도해주세요.", 429);
    if (!verifyAdminPassword(body.password)) throw new ApiError("관리자 인증 실패", 401);
    return Response.json(
      { ok: true },
      { headers: { "Set-Cookie": adminSessionCookie(), "Cache-Control": "no-store" } }
    );
  }

  if (body.action === "logout") {
    return Response.json(
      { ok: true },
      { headers: { "Set-Cookie": clearAdminSessionCookie(), "Cache-Control": "no-store" } }
    );
  }

  await requireAdmin(req);

  if (isDemoMode()) {
    const result = demoAdminAction(body);
    if (result.error) throw new ApiError(result.error, result.status);
    return result;
  }

  switch (body.action) {
    case "draw_recovery_digit": {
      const settings = await getSettings();
      const event = normalizeRecoveryEvent(settings.recovery_event);
      if (recoveryState(event) !== RECOVERY_STATES.ENDED) {
        throw new ApiError("복구 시간이 끝난 뒤에 숫자를 추첨할 수 있어요.", 409);
      }
      if (event.winningDigit !== "") return { ok: true, digit: Number(event.winningDigit), alreadyDrawn: true };
      const { data: rows, error } = await sb()
        .from("recovery_entries")
        .select("ticket_no, users ( nickname )")
        .eq("event_key", event.key);
      requireDbSuccess(error, "복구 접수 목록을 불러오지 못했습니다");
      if (!rows?.length) throw new ApiError("아직 복구 인증 접수가 없습니다.", 409);
      const digits = [...new Set(rows.map((row) => recoveryTicketDigit(row.ticket_no)))];
      const digit = digits[crypto.randomInt(digits.length)];
      const nextEvent = { ...event, winningDigit: String(digit) };
      const { data: updated, error: updateError } = await sb()
        .from("settings")
        .update({ value: serializeRecoveryEvent(nextEvent) })
        .eq("key", "recovery_event")
        .eq("value", settings.recovery_event || "")
        .select("key")
        .maybeSingle();
      if (updateError) throw new ApiError("복구 숫자를 저장하지 못했습니다.", 500);
      if (!updated) throw new ApiError("복구 숫자가 이미 추첨되었거나 설정이 없습니다.", 409);
      invalidateSettingsCache();
      return {
        ok: true,
        digit,
        winners: rows
          .filter((row) => recoveryTicketDigit(row.ticket_no) === digit)
          .map((row) => ({ nickname: row.users?.nickname || "?", ticket: recoveryTicketLabel(row.ticket_no) })),
      };
    }
    case "set_setting": {
      if (!EDITABLE_KEYS.includes(body.key)) throw new ApiError("수정할 수 없는 설정입니다.");
      if (body.key === "upload_start" || body.key === "upload_end") {
        throw new ApiError("업로드 기간은 시작과 마감 시각을 함께 저장해주세요.");
      }
      let value = String(body.value ?? "");

      if (body.key === "event_guide") {
        let guide;
        try {
          guide = typeof body.value === "string" ? JSON.parse(body.value) : body.value;
        } catch {
          throw new ApiError("행사 안내 형식이 올바르지 않습니다.");
        }
        if (!guide || typeof guide !== "object" || Array.isArray(guide)) {
          throw new ApiError("행사 안내 형식이 올바르지 않습니다.");
        }
        value = serializeEventGuide(guide);
      }

      // 기간 값이 파싱 불가능한 문자열로 저장되면 uploadPeriodState가 CLOSED로 떨어져
      // 전 회원의 업로드·응모가 조용히 막힌다. 저장 전에 막는다.
      if (body.key === "upload_start" || body.key === "upload_end") {
        if (Number.isNaN(new Date(value).getTime())) {
          throw new ApiError("시각 형식이 올바르지 않습니다. 예: 2026-08-01T06:00:00+09:00");
        }
      }
      if (body.key === "draw_date" && value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new ApiError("추첨일은 YYYY-MM-DD 형식으로 입력해주세요.");
      }

      const { error } = await sb()
        .from("settings")
        .upsert({ key: body.key, value });
      if (error) throw new ApiError(error.message, 500);
      invalidateSettingsCache();
      return { ok: true };
    }

    case "draw_numbers": {
      const { data: digits, error } = await sb().rpc("append_winning_number", { p_digit: String(crypto.randomInt(10)) });
      if (error) {
        if (String(error.message).includes("DRAW_COMPLETE")) {
          throw new ApiError("이미 3자리 모두 추첨되었습니다. 다시 하려면 초기화하세요.", 409);
        }
        throw new ApiError("추첨 번호를 저장하지 못했습니다.", 500);
      }
      invalidateSettingsCache();
      // 마지막 자리를 뽑은 순간 1등이 있는지까지 알려줘야 다음 차수로 넘어갈지 판단할 수 있다.
      if (String(digits).length !== LOTTO_DRAW_DIGITS) return { ok: true, digits, complete: false };
      return { ok: true, ...(await lottoRoundState(await getSettings())) };
    }

    // 1등이 안 나온 차수를 기록에 남기고 번호를 비워 다음 차수를 시작한다.
    case "next_lotto_round": {
      const settings = await getSettings();
      const state = await lottoRoundState(settings);
      if (!state.complete) throw new ApiError("3자리를 모두 뽑은 뒤에 다음 차수로 넘어갈 수 있습니다.");
      if (state.winners.length > 0) {
        throw new ApiError("1등이 나온 차수입니다. 다음 차수로 넘어갈 수 없어요.");
      }

      const pastRounds = [...state.pastRounds, state.digits];
      const { error } = await sb().from("settings").upsert([
        { key: "lotto_rounds", value: serializeLottoRounds(pastRounds) },
        { key: "winning_numbers", value: "" },
      ]);
      requireDbSuccess(error, "다음 차수를 시작하지 못했습니다");
      invalidateSettingsCache();
      return { ok: true, digits: "", round: currentLottoRound(pastRounds), pastRounds, complete: false, winners: null };
    }

    // 차수 기록까지 전부 지우고 1차부터 다시 시작한다.
    case "reset_draw": {
      const { error } = await sb().from("settings").upsert([
        { key: "lotto_rounds", value: "[]" },
        { key: "winning_numbers", value: "" },
      ]);
      requireDbSuccess(error, "추첨을 초기화하지 못했습니다");
      invalidateSettingsCache();
      return { ok: true, digits: "", round: 1, pastRounds: [], complete: false, winners: null };
    }

    case "set_upload_period": {
      const start = String(body.start || "");
      const end = String(body.end || "");
      if (Number.isNaN(new Date(start).getTime()) || Number.isNaN(new Date(end).getTime())) {
        throw new ApiError("시각 형식이 올바르지 않습니다.");
      }
      const { error } = await sb().rpc("set_upload_period", { p_start: start, p_end: end });
      if (error) {
        if (String(error.message).includes("INVALID_UPLOAD_PERIOD")) {
          throw new ApiError("마감 시각은 시작 시각보다 뒤여야 합니다.");
        }
        throw new ApiError("업로드 기간을 저장하지 못했습니다.", 500);
      }
      invalidateSettingsCache();
      return { ok: true };
    }

    case "reset_board": {
      // 회원 빙고판 리셋: 칸 + 업로드 사진 전부 삭제 → 다시 뽑기 가능
      const userId = String(body.userId || "");
      if (!userId) throw new ApiError("회원이 지정되지 않았습니다.");
      const { data: cells, error: cellsError } = await sb()
        .from("cells")
        .select("photo_path")
        .eq("user_id", userId)
        .not("photo_path", "is", null);
      requireDbSuccess(cellsError, "빙고 사진을 확인하지 못했습니다");
      const { error } = await sb().rpc("admin_reset_bingo_board", { p_user_id: userId });
      if (error) throw new ApiError("빙고판 초기화에 실패했습니다.", 500);
      invalidateBingoHallCache();
      // 원본과 함께 그리드용 축소본도 지운다. 원본만 지우면 축소본이 버킷에 남는다.
      const cleanup = await schedulePhotoCleanup(
        (cells || []).flatMap((c) => [c.photo_path, thumbPathFor(c.photo_path)])
      );
      return { ok: true, cleanupPending: cleanup.pending };
    }

    case "delete_user": {
      // 회원 계정 삭제: cells·lotto_entries는 FK cascade로 함께 삭제되므로
      // 미리 사진 경로만 모아뒀다가 Storage 파일을 정리한다.
      const userId = String(body.userId || "");
      if (!userId) throw new ApiError("회원이 지정되지 않았습니다.");

      const [{ data: cells, error: cellsError }, { data: entries, error: entriesError }, { data: recovery, error: recoveryError }] = await Promise.all([
        sb().from("cells").select("photo_path").eq("user_id", userId).not("photo_path", "is", null),
        sb().from("lotto_entries").select("photo_path").eq("user_id", userId),
        sb().from("recovery_entries").select("photo_path").eq("user_id", userId),
      ]);
      requireDbSuccess(cellsError || entriesError || recoveryError, "회원 사진을 확인하지 못했습니다");

      const { data: deleted, error } = await sb().from("users").delete().eq("id", userId).select("id").maybeSingle();
      if (error) throw new ApiError(error.message, 500);
      if (!deleted) throw new ApiError("회원을 찾을 수 없습니다.", 404);
      invalidateBingoHallCache();

      // 빙고 사진에는 축소본이 따로 있다. 로또 사진에는 없어 원본만 지운다.
      const cleanup = await schedulePhotoCleanup([
        ...(cells || []).flatMap((c) => [c.photo_path, thumbPathFor(c.photo_path)]),
        ...(entries || []).map((e) => e.photo_path),
        ...(recovery || []).map((e) => e.photo_path),
      ]);
      return { ok: true, cleanupPending: cleanup.pending };
    }

    case "delete_cell_photo": {
      const { data: cell, error: lookupError } = await sb()
        .from("cells")
        .select("id, photo_path")
        .eq("id", body.cellId)
        .maybeSingle();
      requireDbSuccess(lookupError, "사진을 확인하지 못했습니다");
      if (!cell?.photo_path) throw new ApiError("사진이 없습니다.");
      const { error } = await sb().from("cells").update({ photo_path: null, uploaded_at: null, uploaded_date: null, photo_meta: null }).eq("id", cell.id);
      requireDbSuccess(error, "인증 사진 삭제에 실패했습니다");
      invalidateBingoHallCache();
      const cleanup = await schedulePhotoCleanup([cell.photo_path, thumbPathFor(cell.photo_path)]);
      return { ok: true, cleanupPending: cleanup.pending };
    }

    case "delete_lotto_entry": {
      const { data: entry, error: lookupError } = await sb()
        .from("lotto_entries")
        .select("id, photo_path")
        .eq("id", body.entryId)
        .maybeSingle();
      requireDbSuccess(lookupError, "응모를 확인하지 못했습니다");
      if (!entry) throw new ApiError("응모를 찾을 수 없습니다.", 404);
      const { error } = await sb().from("lotto_entries").delete().eq("id", entry.id);
      requireDbSuccess(error, "응모 삭제에 실패했습니다");
      const cleanup = await schedulePhotoCleanup([entry.photo_path]);
      return { ok: true, cleanupPending: cleanup.pending };
    }

    // 인증 사진을 확인한 4줄 달성자를 확정한다. 확정한 뒤에는 그 회원이 사진을 바꿔도
    // 달성 시각이 밀리지 않아, 선물 20명 순위가 조용히 뒤집히지 않는다.
    case "confirm_four_line": {
      const userId = String(body.userId || "");
      if (!userId) throw new ApiError("회원이 지정되지 않았습니다.");

      const { cells } = await getAllProgress();
      const achievement = fourLineAchievements(cells).find((item) => item.userId === userId);
      if (!achievement) throw new ApiError("아직 4줄을 완성하지 않은 회원입니다.");

      const { error } = await sb()
        .from("four_line_awards")
        .upsert(
          { user_id: userId, achieved_at: achievement.achievedAt, confirmed_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );
      requireDbSuccess(error, "4줄 달성을 확정하지 못했습니다");
      return { ok: true, achievedAt: achievement.achievedAt };
    }

    // 밀린 사진 정리를 지금 다시 시도한다. 평소에는 다른 관리자 동작에 묻어 돌지만,
    // 큐에 쌓인 게 보이면 기다리지 않고 바로 밀어볼 수 있어야 한다.
    case "retry_cleanup": {
      const result = await processPhotoCleanup();
      return { ok: true, pending: result.pending, cleanup: await photoCleanupStatus() };
    }

    case "unconfirm_four_line": {
      const userId = String(body.userId || "");
      if (!userId) throw new ApiError("회원이 지정되지 않았습니다.");
      const { error } = await sb().from("four_line_awards").delete().eq("user_id", userId);
      requireDbSuccess(error, "4줄 확정을 취소하지 못했습니다");
      return { ok: true };
    }

    case "reset_user_pin": {
      const userId = String(body.userId || "");
      if (!userId) throw new ApiError("회원이 지정되지 않았습니다.");
      const token = newToken();
      const { data: reset, error } = await sb()
        .from("users")
        .update({
          pin_hash: await hashPin("0000"),
          token_hash: hashToken(token),
          token_expires_at: sessionExpiresAt(),
          failed_pin_attempts: 0,
          pin_locked_at: null,
        })
        .eq("id", userId)
        .select("id")
        .maybeSingle();
      requireDbSuccess(error, "PIN 초기화에 실패했습니다");
      if (!reset) throw new ApiError("회원을 찾을 수 없습니다.", 404);
      return { ok: true, pin: "0000" };
    }

    case "rename_user": {
      const userId = String(body.userId || "");
      const nickname = String(body.nickname || "").trim();
      if (!userId) throw new ApiError("회원을 지정해주세요.");
      if (nickname.length < 1 || nickname.length > 12) throw new ApiError("닉네임은 1~12자로 입력해주세요.");
      const { data, error } = await sb().from("users").update({ nickname }).eq("id", userId).select("id, nickname").maybeSingle();
      if (error?.code === "23505") throw new ApiError("이미 사용 중인 닉네임입니다.", 409);
      requireDbSuccess(error, "닉네임 변경에 실패했습니다.");
      if (!data) throw new ApiError("회원을 찾을 수 없습니다.", 404);
      invalidateSettingsCache();
      return { ok: true, nickname: data.nickname };
    }

    default:
      throw new ApiError("알 수 없는 요청입니다.");
  }
});
