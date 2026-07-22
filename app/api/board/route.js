import { sb, signedUrls } from "@/lib/db";
import { route, requireUser, ApiError } from "@/lib/api";
import { countLines } from "@/lib/bingo";

/** 내 빙고판 조회 */
export const GET = route(async (req) => {
  const user = await requireUser(req);

  const { data: cells, error } = await sb()
    .from("cells")
    .select("position, photo_path, uploaded_at, bingo_items ( content, category )")
    .eq("user_id", user.id)
    .order("position");
  if (error) throw new ApiError(error.message, 500);
  if (!cells?.length) return { cells: [], filled: 0, lines: 0 };

  const urlMap = await signedUrls(cells.map((c) => c.photo_path));
  const filled = cells.filter((c) => c.photo_path).map((c) => c.position);

  return {
    cells: cells.map((c) => ({
      position: c.position,
      content: c.bingo_items?.content || "",
      category: c.bingo_items?.category || 0,
      photoUrl: c.photo_path ? urlMap[c.photo_path] || null : null,
    })),
    filled: filled.length,
    lines: countLines(filled),
  };
});
