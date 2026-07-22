import crypto from "node:crypto";
import { sb, removePhoto, signedUrls } from "@/lib/db";
import { isAdmin, json, err } from "@/lib/auth";
import { countLines } from "@/lib/bingo";
import { getSettings, EDITABLE_KEYS } from "@/lib/settings";

export async function GET(req) {
  if (!isAdmin(req)) return err("관리자 인증 실패", 401);
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "overview";

  if (action === "overview") {
    const settings = await getSettings();
    const { data: users } = await sb().from("users").select("id, nickname, created_at");
    const { data: cells } = await sb()
      .from("cells")
      .select("user_id, position")
      .not("photo_path", "is", null);
    const { data: lotto } = await sb().from("lotto_entries").select("user_id");

    const byUser = new Map();
    for (const c of cells || []) {
      if (!byUser.has(c.user_id)) byUser.set(c.user_id, []);
      byUser.get(c.user_id).push(c.position);
    }
    const lottoCount = new Map();
    for (const e of lotto || []) lottoCount.set(e.user_id, (lottoCount.get(e.user_id) || 0) + 1);

    return json({
      settings,
      users: (users || []).map((u) => {
        const positions = byUser.get(u.id) || [];
        return {
          id: u.id,
          nickname: u.nickname,
          createdAt: u.created_at,
          filled: positions.length,
          lines: countLines(positions),
          lottoEntries: lottoCount.get(u.id) || 0,
        };
      }),
    });
  }

  if (action === "user") {
    const userId = url.searchParams.get("id");
    const { data: cells } = await sb()
      .from("cells")
      .select("id, position, photo_path, uploaded_at, bingo_items ( content, category )")
      .eq("user_id", userId)
      .order("position");
    const { data: entries } = await sb()
      .from("lotto_entries")
      .select("id, digits, photo_path, created_at")
      .eq("user_id", userId)
      .order("created_at");

    const urlMap = await signedUrls([
      ...(cells || []).map((c) => c.photo_path),
      ...(entries || []).map((e) => e.photo_path),
    ]);

    return json({
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
    });
  }

  return err("알 수 없는 요청입니다.");
}

export async function POST(req) {
  if (!isAdmin(req)) return err("관리자 인증 실패", 401);
  const body = await req.json().catch(() => ({}));

  switch (body.action) {
    case "set_setting": {
      if (!EDITABLE_KEYS.includes(body.key)) return err("수정할 수 없는 설정입니다.");
      const { error } = await sb()
        .from("settings")
        .upsert({ key: body.key, value: String(body.value ?? "") });
      if (error) return err(error.message, 500);
      return json({ ok: true });
    }

    case "draw_numbers": {
      // 각 자리 0~9 균등 랜덤 (crypto 기반)
      const digits = Array.from({ length: 4 }, () => crypto.randomInt(10)).join("");
      const { error } = await sb()
        .from("settings")
        .upsert({ key: "winning_numbers", value: digits });
      if (error) return err(error.message, 500);
      return json({ ok: true, digits });
    }

    case "delete_cell_photo": {
      const { data: cell } = await sb()
        .from("cells")
        .select("id, photo_path")
        .eq("id", body.cellId)
        .single();
      if (!cell?.photo_path) return err("사진이 없습니다.");
      await sb().from("cells").update({ photo_path: null, uploaded_at: null }).eq("id", cell.id);
      await removePhoto(cell.photo_path);
      return json({ ok: true });
    }

    case "delete_lotto_entry": {
      const { data: entry } = await sb()
        .from("lotto_entries")
        .select("id, photo_path")
        .eq("id", body.entryId)
        .single();
      if (!entry) return err("응모를 찾을 수 없습니다.", 404);
      await sb().from("lotto_entries").delete().eq("id", entry.id);
      await removePhoto(entry.photo_path);
      return json({ ok: true });
    }

    default:
      return err("알 수 없는 요청입니다.");
  }
}
