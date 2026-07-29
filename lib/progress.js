import { sb } from "./db";
import { countLines } from "./bingo";

/** 전체 회원의 진행 현황 (피드/관리자 공용) */
export async function getAllProgress() {
  const [{ data: users, error: usersError }, { data: cells, error: cellsError }, { data: lotto, error: lottoError }] = await Promise.all([
    sb().from("users").select("id, nickname, created_at"),
    sb().from("cells").select("user_id, position, uploaded_at").not("photo_path", "is", null),
    sb().from("lotto_entries").select("user_id, created_at").not("slot", "is", null),
  ]);
  const error = usersError || cellsError || lottoError;
  if (error) throw new Error(`진행 현황을 불러오지 못했습니다: ${error.message}`);

  const positionsByUser = new Map();
  for (const c of cells || []) {
    if (!positionsByUser.has(c.user_id)) positionsByUser.set(c.user_id, []);
    positionsByUser.get(c.user_id).push(c.position);
  }
  const lottoCountByUser = new Map();
  for (const e of lotto || []) lottoCountByUser.set(e.user_id, (lottoCountByUser.get(e.user_id) || 0) + 1);

  const progress = (users || []).map((u) => {
    const positions = positionsByUser.get(u.id) || [];
    return {
      id: u.id,
      nickname: u.nickname,
      createdAt: u.created_at,
      filled: positions.length,
      lines: countLines(positions),
      lottoEntries: lottoCountByUser.get(u.id) || 0,
    };
  });

  return { progress, users: users || [], cells: cells || [], lotto: lotto || [] };
}
