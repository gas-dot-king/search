import { sb } from "@/lib/db";
import { getUser, json, err } from "@/lib/auth";
import { drawBoard } from "@/lib/bingo";

/** 빙고판 뽑기 (최초 1회) */
export async function POST(req) {
  const user = await getUser(req);
  if (!user) return err("로그인이 필요합니다.", 401);

  const { count } = await sb()
    .from("cells")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((count || 0) > 0) return err("이미 빙고판이 확정되었습니다.");

  const { data: items, error } = await sb().from("bingo_items").select("id, category");
  if (error || !items?.length) return err("빙고 항목을 불러오지 못했습니다.", 500);

  const order = drawBoard(items); // 16개 item id, index = position
  const rows = order.map((itemId, position) => ({ user_id: user.id, position, item_id: itemId }));

  const { error: insErr } = await sb().from("cells").insert(rows);
  if (insErr) {
    // 동시 클릭으로 중복 생성 시 unique 제약이 막아줌
    return err("빙고판 생성 실패: " + insErr.message, 500);
  }

  return json({ ok: true });
}
