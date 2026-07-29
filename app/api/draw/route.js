import { sb } from "@/lib/db";
import { route, requireUser, readJson, ApiError } from "@/lib/api";
import { drawBoard } from "@/lib/bingo";
import { demoDraw, isDemoMode } from "@/lib/demo";

function drawError(error) {
  const code = String(error?.message || "");
  if (code.includes("BINGO_BOARD_EXISTS")) return new ApiError("이미 빙고판이 확정되었습니다.", 409);
  if (code.includes("BINGO_REDRAW_USED")) return new ApiError("다시 뽑기 기회를 이미 사용했습니다.", 409);
  if (code.includes("BINGO_REDRAW_AFTER_UPLOAD")) return new ApiError("이미 인증을 시작해서 다시 뽑을 수 없습니다.", 409);
  return new ApiError("빙고판 생성에 실패했습니다.", 500);
}

/** One atomic DB operation handles the redraw allowance, deletion and insert. */
export const POST = route(async (req) => {
  const user = await requireUser(req);
  const { redraw } = await readJson(req);
  if (isDemoMode()) {
    const result = demoDraw(user.id, Boolean(redraw));
    if (result.error) throw new ApiError(result.error);
    return { ok: true, board: result.board };
  }

  const { data: items, error: itemsError } = await sb()
    .from("bingo_items")
    .select("id, category, content");
  if (itemsError || !items?.length) throw new ApiError("빙고 항목을 불러오지 못했습니다.", 500);

  const order = drawBoard(items);
  const { error } = await sb().rpc("create_or_redraw_bingo_board", {
    p_user_id: user.id,
    p_item_ids: order,
    p_redraw: Boolean(redraw),
  });
  if (error) throw drawError(error);

  const itemById = new Map(items.map((item) => [item.id, item]));
  return {
    ok: true,
    board: {
      cells: order.map((itemId, position) => {
        const item = itemById.get(itemId);
        return { position, content: item?.content || "", category: item?.category || 0, photoUrl: null };
      }),
      filled: 0,
      lines: 0,
    },
  };
});
