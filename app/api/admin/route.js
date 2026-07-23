import crypto from "node:crypto";
import { sb, removePhoto, signedUrls } from "@/lib/db";
import { route, requireAdmin, readJson, ApiError, requireDbSuccess } from "@/lib/api";
import { getSettings, EDITABLE_KEYS } from "@/lib/settings";
import { getAllProgress } from "@/lib/progress";
import { serializeEventGuide } from "@/lib/event";

export const GET = route(async (req) => {
  requireAdmin(req);
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "overview";

  if (action === "overview") {
    const [settings, { progress }, { data: items }] = await Promise.all([
      getSettings(),
      getAllProgress(),
      sb().from("bingo_items").select("id, category, content").order("category").order("id"),
    ]);
    return { settings, users: progress, items: items || [] };
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

      const { error } = await sb()
        .from("settings")
        .upsert({ key: body.key, value });
      if (error) throw new ApiError(error.message, 500);
      return { ok: true };
    }

    case "draw_numbers": {
      // 버튼 누를 때마다 한 자리씩 뽑기 (0~9 균등, crypto 기반)
      const settings = await getSettings();
      const cur = settings.winning_numbers || "";
      if (cur.length >= 4) throw new ApiError("이미 4자리 모두 추첨되었습니다. 다시 하려면 초기화하세요.");
      const digits = cur + crypto.randomInt(10);
      const { error } = await sb().from("settings").upsert({ key: "winning_numbers", value: digits });
      if (error) throw new ApiError(error.message, 500);
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
      for (const c of cells || []) await removePhoto(c.photo_path);
      // 다시 뽑기 기회도 초기화 → 처음 흐름부터 다시
      const { error: resetFlagError } = await sb().from("settings").delete().eq("key", `redraw:${userId}`);
      requireDbSuccess(resetFlagError, "다시 뽑기 상태 초기화에 실패했습니다");
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
