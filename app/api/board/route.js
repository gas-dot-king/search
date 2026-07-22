import { sb, signedUrls } from "@/lib/db";
import { getUser, json, err } from "@/lib/auth";
import { countLines } from "@/lib/bingo";

/** 내 빙고판 조회 */
export async function GET(req) {
  const user = await getUser(req);
  if (!user) return err("로그인이 필요합니다.", 401);

  const { data: cells, error } = await sb()
    .from("cells")
    .select("position, photo_path, uploaded_at, bingo_items ( content, category )")
    .eq("user_id", user.id)
    .order("position");
  if (error) return err(error.message, 500);
  if (!cells?.length) return json({ cells: [], filled: 0, lines: 0 });

  const urlMap = await signedUrls(cells.map((c) => c.photo_path));
  const filled = cells.filter((c) => c.photo_path).map((c) => c.position);

  return json({
    cells: cells.map((c) => ({
      position: c.position,
      content: c.bingo_items?.content || "",
      category: c.bingo_items?.category || 0,
      photoUrl: c.photo_path ? urlMap[c.photo_path] || null : null,
    })),
    filled: filled.length,
    lines: countLines(filled),
  });
}
