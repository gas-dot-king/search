import crypto from "node:crypto";
import { sb, removePhoto, removePhotos, signedUrls } from "@/lib/db";
import { clearUserCache } from "@/lib/auth";
import { route, requireAdmin, readJson, ApiError, requireDbSuccess } from "@/lib/api";
import { getSettings, invalidateSettingsCache, editableSettings, EDITABLE_KEYS } from "@/lib/settings";
import { getAllProgress } from "@/lib/progress";
import { serializeEventGuide } from "@/lib/event";
import { LOTTO_DRAW_DIGITS } from "@/lib/lotto";
import {
  demoAdminUser,
  demoDeleteCellPhoto,
  demoDeleteLottoEntry,
  demoDeleteUser,
  demoDrawNumbers,
  demoItems,
  demoProgress,
  demoResetBoard,
  demoSetSetting,
  demoSettings,
  isDemoMode,
} from "@/lib/demo";

export const GET = route(async (req) => {
  requireAdmin(req);
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "overview";

  if (isDemoMode()) {
    if (action === "overview") {
      const progress = demoProgress();
      return { settings: demoSettings(), users: progress.progress, items: demoItems() };
    }
    if (action === "user") return demoAdminUser(url.searchParams.get("id"));
    throw new ApiError("알 수 없는 요청입니다.");
  }

  if (action === "overview") {
    const [settings, { progress }, { data: items }] = await Promise.all([
      getSettings(),
      getAllProgress(),
      sb().from("bingo_items").select("id, category, content").order("category").order("id"),
    ]);
    return { settings: editableSettings(settings), users: progress, items: items || [] };
  }

  if (action === "user") {
    const userId = url.searchParams.get("id");
    const [{ data: cells }, { data: entries }] = await Promise.all([
      sb()
        .from("cells")
        .select("id, position, photo_path, uploaded_at, bingo_items ( content, category )")
        .eq("user_id", userId)
        .order("position"),
      sb()
        .from("lotto_entries")
        .select("id, digits, photo_path, created_at")
        .eq("user_id", userId)
        .order("created_at"),
    ]);

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
  requireAdmin(req);
  const body = await readJson(req);

  if (isDemoMode()) {
    switch (body.action) {
      case "set_setting":
        return demoSetSetting(body.key, body.key === "event_guide" ? serializeEventGuide(body.value) : body.value);
      case "draw_numbers": {
        const result = demoDrawNumbers();
        if (result.error) throw new ApiError(result.error);
        return result;
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
      // 버튼 누를 때마다 한 자리씩 뽑기 (0~9 균등, crypto 기반)
      // 캐시된 설정을 쓰면 다른 서버 인스턴스에서 방금 뽑은 자리를 덮어쓸 수 있어 DB에서 직접 읽는다.
      const { data: row } = await sb().from("settings").select("value").eq("key", "winning_numbers").maybeSingle();
      const cur = row?.value || "";
      if (cur.length >= LOTTO_DRAW_DIGITS) {
        throw new ApiError("이미 3자리 모두 추첨되었습니다. 다시 하려면 초기화하세요.");
      }
      const digits = cur + crypto.randomInt(10);
      const { error } = await sb().from("settings").upsert({ key: "winning_numbers", value: digits });
      if (error) throw new ApiError(error.message, 500);
      invalidateSettingsCache();
      return { ok: true, digits };
    }

    case "reset_board": {
      // 회원 빙고판 리셋: 칸 + 업로드 사진 전부 삭제 → 다시 뽑기 가능
      const userId = String(body.userId || "");
      if (!userId) throw new ApiError("회원이 지정되지 않았습니다.");
      const { data: cells } = await sb()
        .from("cells")
        .select("photo_path")
        .eq("user_id", userId)
        .not("photo_path", "is", null);
      const { error } = await sb().from("cells").delete().eq("user_id", userId);
      if (error) throw new ApiError(error.message, 500);
      await removePhotos((cells || []).map((c) => c.photo_path));
      // 다시 뽑기 기회도 초기화 → 처음 흐름부터 다시
      const { error: resetFlagError } = await sb().from("settings").delete().eq("key", `redraw:${userId}`);
      requireDbSuccess(resetFlagError, "다시 뽑기 상태 초기화에 실패했습니다");
      return { ok: true };
    }

    case "delete_user": {
      // 회원 계정 삭제: cells·lotto_entries는 FK cascade로 함께 삭제되므로
      // 미리 사진 경로만 모아뒀다가 Storage 파일을 정리한다.
      const userId = String(body.userId || "");
      if (!userId) throw new ApiError("회원이 지정되지 않았습니다.");

      const [{ data: cells }, { data: entries }] = await Promise.all([
        sb().from("cells").select("photo_path").eq("user_id", userId).not("photo_path", "is", null),
        sb().from("lotto_entries").select("photo_path").eq("user_id", userId),
      ]);

      const { error } = await sb().from("users").delete().eq("id", userId);
      if (error) throw new ApiError(error.message, 500);

      await removePhotos([
        ...(cells || []).map((c) => c.photo_path),
        ...(entries || []).map((e) => e.photo_path),
      ]);
      // 다시 뽑기 플래그가 settings에 남지 않게 정리하고, 캐시된 토큰도 즉시 무효화한다.
      const { error: redrawFlagError } = await sb().from("settings").delete().eq("key", `redraw:${userId}`);
      requireDbSuccess(redrawFlagError, "다시 뽑기 상태 정리에 실패했습니다");
      clearUserCache();
      return { ok: true };
    }

    case "delete_cell_photo": {
      const { data: cell } = await sb()
        .from("cells")
        .select("id, photo_path")
        .eq("id", body.cellId)
        .single();
      if (!cell?.photo_path) throw new ApiError("사진이 없습니다.");
      const { error } = await sb().from("cells").update({ photo_path: null, uploaded_at: null }).eq("id", cell.id);
      requireDbSuccess(error, "인증 사진 삭제에 실패했습니다");
      await removePhoto(cell.photo_path);
      return { ok: true };
    }

    case "delete_lotto_entry": {
      const { data: entry } = await sb()
        .from("lotto_entries")
        .select("id, photo_path")
        .eq("id", body.entryId)
        .single();
      if (!entry) throw new ApiError("응모를 찾을 수 없습니다.", 404);
      const { error } = await sb().from("lotto_entries").delete().eq("id", entry.id);
      requireDbSuccess(error, "응모 삭제에 실패했습니다");
      await removePhoto(entry.photo_path);
      return { ok: true };
    }

    default:
      throw new ApiError("알 수 없는 요청입니다.");
  }
});
