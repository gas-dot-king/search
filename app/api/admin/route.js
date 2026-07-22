import crypto from "node:crypto";
import { sb, removePhoto, signedUrls } from "@/lib/db";
import { route, requireAdmin, readJson, ApiError } from "@/lib/api";
import { getSettings, EDITABLE_KEYS } from "@/lib/settings";
import { getAllProgress } from "@/lib/progress";

export const GET = route(async (req) => {
  requireAdmin(req);
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "overview";

  if (action === "overview") {
    const [settings, { progress }] = await Promise.all([getSettings(), getAllProgress()]);
    return { settings, users: progress };
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
      const { error } = await sb()
        .from("settings")
        .upsert({ key: body.key, value: String(body.value ?? "") });
      if (error) throw new ApiError(error.message, 500);
      return { ok: true };
    }

    case "draw_numbers": {
      // 각 자리 0~9 균등 랜덤 (crypto 기반)
      const digits = Array.from({ length: 4 }, () => crypto.randomInt(10)).join("");
      const { error } = await sb().from("settings").upsert({ key: "winning_numbers", value: digits });
      if (error) throw new ApiError(error.message, 500);
      return { ok: true, digits };
    }

    case "delete_cell_photo": {
      const { data: cell } = await sb()
        .from("cells")
        .select("id, photo_path")
        .eq("id", body.cellId)
        .single();
      if (!cell?.photo_path) throw new ApiError("사진이 없습니다.");
      await sb().from("cells").update({ photo_path: null, uploaded_at: null }).eq("id", cell.id);
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
      await sb().from("lotto_entries").delete().eq("id", entry.id);
      await removePhoto(entry.photo_path);
      return { ok: true };
    }

    default:
      throw new ApiError("알 수 없는 요청입니다.");
  }
});
