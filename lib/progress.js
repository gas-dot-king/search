import { sb } from "./db";
import { countLines } from "./bingo";
import { bingoHallOfFame, fourLineAchievements } from "./hall";

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

// 명예의 전당 빙고 집계는 방문자마다 달라지지 않는데 세 테이블을 통째로 읽는
// 무거운 조회다. 한 시간에 한 번만 계산해 그동안은 모든 방문자가 같은 결과를 본다.
// (인증 직후 내 순위를 바로 보려면 빙고 화면과 피드를 쓰면 된다 — 그쪽은 실시간이다)
const BINGO_HALL_TTL_MS = 60 * 60 * 1000;
let cachedBingoHall = null;

/** 명예의 전당용 빙고 집계 (1시간 캐시, updatedAt은 실제 집계 시각) */
export async function getBingoHallOfFame() {
  const hour = Math.floor(Date.now() / BINGO_HALL_TTL_MS);
  if (cachedBingoHall?.hour === hour) return cachedBingoHall.value;

  const { progress, users, cells } = await getAllProgress();
  const nicknameOf = new Map(users.map((user) => [user.id, user.nickname]));
  const fourLine = fourLineAchievements(cells);
  const value = {
    ...bingoHallOfFame(progress, fourLine),
    // 회원 id는 화면에 필요 없으니 닉네임만 내보낸다.
    fourLine: fourLine.map(({ rank, userId, achievedAt }) => ({
      rank,
      nickname: nicknameOf.get(userId) || "?",
      achievedAt,
    })),
    updatedAt: new Date().toISOString(),
  };
  cachedBingoHall = { hour, value };
  return value;
}

/** 회원·인증을 지우는 관리자 동작 뒤에 호출해, 사라진 기록이 남지 않게 한다 */
export function invalidateBingoHallCache() {
  cachedBingoHall = null;
}
