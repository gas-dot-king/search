import { sb, signedUrls } from "@/lib/db";
import { route, requireUser, ApiError } from "@/lib/api";
import { countLines } from "@/lib/bingo";
import { demoBoard, isDemoMode } from "@/lib/demo";

/** 내 빙고판 조회 */
export const GET = route(async (req) => {
  const user = await requireUser(req);
  if (isDemoMode()) return demoBoard(user.id);

  const { data: cells, error } = await sb()
    .from("cells")
    .select("position, photo_path, uploaded_at, bingo_items ( content, category )")
    .eq("user_id", user.id)
    .order("position");
  if (error) throw new ApiError(error.message, 500);
  if (!cells?.length) return { nickname: user.nickname, cells: [], filled: 0, lines: 0, photosLoaded: true };

  const urlMap = await signedUrls(cells.map((c) => c.photo_path));
  const filled = cells.filter((c) => c.photo_path).map((c) => c.position);

  return {
    nickname: user.nickname,
    cells: cells.map((c) => ({
      position: c.position,
      content: c.bingo_items?.content || "",
      category: c.bingo_items?.category || 0,
      hasPhoto: Boolean(c.photo_path),
      photoUrl: c.photo_path ? urlMap[c.photo_path] || null : null,
    })),
    filled: filled.length,
    lines: countLines(filled),
    photosLoaded: true,
  };
});
