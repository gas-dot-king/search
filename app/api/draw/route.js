import { sb, userHasBoard } from "@/lib/db";
import { route, requireUser, readJson, ApiError, requireDbSuccess } from "@/lib/api";
import { drawBoard } from "@/lib/bingo";

const redrawKey = (userId) => `redraw:${userId}`;

/**
 * 빙고판 뽑기.
 * - 최초 1회 생성
 * - { redraw: true } 로 딱 한 번 다시 뽑기 가능 (사진 업로드 전, 이후 강제 확정)
 */
export const POST = route(async (req) => {
  const user = await requireUser(req);
  const { redraw } = await readJson(req);
  const hasBoard = await userHasBoard(user.id);

  if (hasBoard && !redraw) throw new ApiError("이미 빙고판이 확정되었습니다.");

  if (hasBoard && redraw) {
    // 다시 뽑기는 1회만
    const { data: used } = await sb().from("settings").select("key").eq("key", redrawKey(user.id)).single();
    if (used) throw new ApiError("다시 뽑기 기회를 이미 사용했습니다.");

    // 인증을 시작했다면 다시 뽑기 불가
    const { count } = await sb()
      .from("cells")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .not("photo_path", "is", null);
    if ((count || 0) > 0) throw new ApiError("이미 인증을 시작해서 다시 뽑을 수 없습니다.");

    const { error: redrawError } = await sb().from("settings").insert({ key: redrawKey(user.id), value: "1" });
    requireDbSuccess(redrawError, "다시 뽑기 상태 저장에 실패했습니다");
    const { error: deleteError } = await sb().from("cells").delete().eq("user_id", user.id);
    if (deleteError) {
      const { error: rollbackError } = await sb().from("settings").delete().eq("key", redrawKey(user.id));
      requireDbSuccess(rollbackError, "다시 뽑기 상태 복구에 실패했습니다");
    }
    requireDbSuccess(deleteError, "기존 빙고판 삭제에 실패했습니다");
  }

  const { data: items, error } = await sb().from("bingo_items").select("id, category, content");
  if (error || !items?.length) throw new ApiError("빙고 항목을 불러오지 못했습니다.", 500);

  const order = drawBoard(items); // 16개 item id, index = position
  const rows = order.map((itemId, position) => ({ user_id: user.id, position, item_id: itemId }));
  const itemById = new Map(items.map((item) => [item.id, item]));

  // 동시 클릭으로 중복 생성 시 unique 제약이 막아줌
  const { error: insErr } = await sb().from("cells").insert(rows);
  if (insErr) throw new ApiError("빙고판 생성 실패: " + insErr.message, 500);

  return {
    ok: true,
    board: {
      cells: order.map((itemId, position) => {
        const item = itemById.get(itemId);
        return {
          position,
          content: item?.content || "",
          category: item?.category || 0,
          photoUrl: null,
        };
      }),
      filled: 0,
      lines: 0,
    },
  };
});
