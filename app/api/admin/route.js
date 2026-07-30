import crypto from "node:crypto";
import { sb, processPhotoCleanup, schedulePhotoCleanup, signedUrls } from "@/lib/db";
import { hashPin, hashToken, newToken, sessionExpiresAt } from "@/lib/auth";
import { route, requireAdmin, readJson, ApiError, requireDbSuccess } from "@/lib/api";
import { getSettings, invalidateSettingsCache, editableSettings, EDITABLE_KEYS } from "@/lib/settings";
import { getAllProgress, invalidateBingoHallCache } from "@/lib/progress";
import { serializeEventGuide } from "@/lib/event";
import { fourLineAchievements } from "@/lib/hall";
import {
  computeWinners,
  currentLottoRound,
  parseLottoRounds,
  serializeLottoRounds,
  LOTTO_DRAW_DIGITS,
} from "@/lib/lotto";
import {
  demoAdminUser,
  demoDeleteCellPhoto,
  demoDeleteLottoEntry,
  demoDeleteUser,
  demoDrawNumbers,
  demoFourLineRanking,
  demoItems,
  demoLottoRound,
  demoNextLottoRound,
  demoProgress,
  demoResetBoard,
  demoResetDraw,
  demoResetUserPin,
  demoRenameUser,
  demoSetSetting,
  demoSettings,
  isDemoMode,
} from "@/lib/demo";

/** 현재 차수의 추첨 상태 — 3자리가 다 나왔으면 1등까지 계산해서 돌려준다 */
async function lottoRoundState(settings) {
  const digits = settings.winning_numbers || "";
  const pastRounds = parseLottoRounds(settings.lotto_rounds);
  const complete = digits.length === LOTTO_DRAW_DIGITS;

  const { data: entries, error } = await sb()
    .from("lotto_entries")
    .select("digits, users ( nickname )")
    .not("slot", "is", null);
  requireDbSuccess(error, "응모 내역을 불러오지 못했습니다");

  return {
    digits,
    round: currentLottoRound(pastRounds),
    pastRounds,
    complete,
    entryCount: (entries || []).length,
    winners: complete ? computeWinners(entries, digits) : null,
  };
}

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
      };
    }
    if (action === "user") return demoAdminUser(url.searchParams.get("id"));
    if (action === "lotto_round") return demoLottoRound();
    throw new ApiError("알 수 없는 요청입니다.");
  }

  if (action === "lotto_round") {
    return Response.json(await lottoRoundState(await getSettings()), {
      headers: { "Cache-Control": "no-store", "Vary": "x-admin-password" },
    });
  }

  if (action === "overview") {
    const [settings, { progress, cells }, { data: items, error: itemsError }] = await Promise.all([
      getSettings(),
      getAllProgress(),
      sb().from("bingo_items").select("id, category, content").order("category").order("id"),
    ]);
    requireDbSuccess(itemsError, "빙고 항목을 불러오지 못했습니다");

    // 선물이 걸린 4줄 선착순은 운영진이 인증 사진을 직접 확인해야 하므로 회원 id까지 함께 준다.
    const nicknameOf = new Map(progress.map((user) => [user.id, user.nickname]));
    const fourLine = fourLineAchievements(cells).map(({ rank, userId, achievedAt }) => ({
      rank,
      id: userId,
      nickname: nicknameOf.get(userId) || "?",
      achievedAt,
    }));

    return Response.json(
      { settings: editableSettings(settings), users: progress, items: items || [], fourLine },
      { headers: { "Cache-Control": "no-store", "Vary": "x-admin-password" } }
    );
  }

  if (action === "user") {
    const userId = url.searchParams.get("id");
    const [{ data: cells, error: cellsError }, { data: entries, error: entriesError }] = await Promise.all([
      sb()
        .from("cells")
        .select("id, position, photo_path, uploaded_at, bingo_items ( content, category )")
        .eq("user_id", userId)
        .order("position"),
      sb()
        .from("lotto_entries")
        .select("id, digits, photo_path, created_at")
        .eq("user_id", userId)
        .not("slot", "is", null)
        .order("created_at"),
    ]);
    requireDbSuccess(cellsError || entriesError, "회원 인증 정보를 불러오지 못했습니다");

    const urlMap = await signedUrls([
      ...(cells || []).map((c) => c.photo_path),
      ...(entries || []).map((e) => e.photo_path),
    ]);

    return {
      cells: (cells || []).map((c) => ({
        id: c.id,
        position: c.position,
        content: c.bingo_items?.content || "",
        category: c.bingo_items?.category || 0,
        photoUrl: c.photo_path ? urlMap[c.photo_path] || null : null,
        uploadedAt: c.uploaded_at,
      })),
      lotto: (entries || []).map((e) => ({
        id: e.id,
        digits: e.digits,
        photoUrl: urlMap[e.photo_path] || null,
        createdAt: e.created_at,
      })),
    };
  }

  throw new ApiError("알 수 없는 요청입니다.");
});

export const POST = route(async (req) => {
  await requireAdmin(req);
  const body = await readJson(req);
  if (!isDemoMode()) await processPhotoCleanup();

  if (isDemoMode()) {
    switch (body.action) {
      case "set_setting": {
        if (!EDITABLE_KEYS.includes(body.key) || body.key === "upload_start" || body.key === "upload_end") {
          throw new ApiError("수정할 수 없는 설정입니다.");
        }
        return demoSetSetting(body.key, body.key === "event_guide" ? serializeEventGuide(body.value) : body.value);
      }
      case "draw_numbers": {
        const result = demoDrawNumbers();
        if (result.error) throw new ApiError(result.error);
        return result;
      }
      case "next_lotto_round": {
        const result = demoNextLottoRound();
        if (result.error) throw new ApiError(result.error);
        return result;
      }
      case "reset_draw":
        return demoResetDraw();
      case "reset_user_pin": {
        const result = demoResetUserPin(String(body.userId || ""));
        if (result.error) throw new ApiError(result.error, result.status);
        return result;
      }
      case "rename_user": {
        const nickname = String(body.nickname || "").trim();
        if (nickname.length < 1 || nickname.length > 12) throw new ApiError("닉네임은 1~12자로 입력해주세요.");
        const result = demoRenameUser(String(body.userId || ""), nickname);
        if (result.error) throw new ApiError(result.error, result.status);
        return result;
      }
      case "set_upload_period": {
        const start = String(body.start || "");
        const end = String(body.end || "");
        if (Number.isNaN(new Date(start).getTime()) || Number.isNaN(new Date(end).getTime()) || new Date(start) >= new Date(end)) {
          throw new ApiError("업로드 시작과 마감 시각을 올바르게 입력해주세요.");
        }
        demoSetSetting("upload_start", start);
        return demoSetSetting("upload_end", end);
      }
      case "reset_board":
        return demoResetBoard(String(body.userId || ""));
      case "delete_user":
        return demoDeleteUser(String(body.userId || ""));
      case "delete_cell_photo": {
        const result = demoDeleteCellPhoto(body.cellId);
        if (result.error) throw new ApiError(result.error);
        return result;
      }
      case "delete_lotto_entry": {
        const result = demoDeleteLottoEntry(body.entryId);
        if (result.error) throw new ApiError(result.error, result.status);
        return result;
      }
      default:
        throw new ApiError("알 수 없는 요청입니다.");
    }
  }

  switch (body.action) {
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
      const cleanup = await schedulePhotoCleanup((cells || []).map((c) => c.photo_path));
      return { ok: true, cleanupPending: cleanup.pending };
    }

    case "delete_user": {
      // 회원 계정 삭제: cells·lotto_entries는 FK cascade로 함께 삭제되므로
      // 미리 사진 경로만 모아뒀다가 Storage 파일을 정리한다.
      const userId = String(body.userId || "");
      if (!userId) throw new ApiError("회원이 지정되지 않았습니다.");

      const [{ data: cells, error: cellsError }, { data: entries, error: entriesError }] = await Promise.all([
        sb().from("cells").select("photo_path").eq("user_id", userId).not("photo_path", "is", null),
        sb().from("lotto_entries").select("photo_path").eq("user_id", userId),
      ]);
      requireDbSuccess(cellsError || entriesError, "회원 사진을 확인하지 못했습니다");

      const { data: deleted, error } = await sb().from("users").delete().eq("id", userId).select("id").maybeSingle();
      if (error) throw new ApiError(error.message, 500);
      if (!deleted) throw new ApiError("회원을 찾을 수 없습니다.", 404);
      invalidateBingoHallCache();

      const cleanup = await schedulePhotoCleanup([
        ...(cells || []).map((c) => c.photo_path),
        ...(entries || []).map((e) => e.photo_path),
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
      const { error } = await sb().from("cells").update({ photo_path: null, uploaded_at: null, uploaded_date: null }).eq("id", cell.id);
      requireDbSuccess(error, "인증 사진 삭제에 실패했습니다");
      invalidateBingoHallCache();
      const cleanup = await schedulePhotoCleanup([cell.photo_path]);
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
