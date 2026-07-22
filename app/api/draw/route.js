import { sb, userHasBoard } from "@/lib/db";
import { route, requireUser, ApiError } from "@/lib/api";
import { drawBoard } from "@/lib/bingo";

/** 빙고판 뽑기 (최초 1회) */
export const POST = route(async (req) => {
  const user = await requireUser(req);

  if (await userHasBoard(user.id)) throw new ApiError("이미 빙고판이 확정되었습니다.");

  const { data: items, error } = await sb().from("bingo_items").select("id, category");
  if (error || !items?.length) throw new ApiError("빙고 항목을 불러오지 못했습니다.", 500);

  const order = drawBoard(items); // 16개 item id, index = position
  const rows = order.map((itemId, position) => ({ user_id: user.id, position, item_id: itemId }));

  // 동시 클릭으로 중복 생성 시 unique 제약이 막아줌
  const { error: insErr } = await sb().from("cells").insert(rows);
  if (insErr) throw new ApiError("빙고판 생성 실패: " + insErr.message, 500);

  return { ok: true };
});
