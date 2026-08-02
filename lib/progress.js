import { sb, selectAllRows } from "./db";
import { countLines } from "./bingo";
import { bingoHallOfFame, fourLineAchievements, mergeFourLineAwards } from "./hall";

/** 전체 회원의 진행 현황 (피드/관리자 공용) */
async function loadAllProgress(includeAllCells) {
  const [{ data: users, error: usersError }, cells, { data: lotto, error: lottoError }] = await Promise.all([
    sb().from("users").select("id, nickname, created_at"),
    // item_id는 어떤 항목이 인기/기피인지 집계하는 데 쓴다.
    // 인증 사진은 회원 수 × 16까지 늘어나 한 번에 다 못 읽으므로 나눠 읽는다.
    selectAllRows(
      "cells",
      includeAllCells ? "user_id, position, item_id, uploaded_at, photo_path" : "user_id, position, item_id, uploaded_at",
      (query) => (includeAllCells ? query : query.not("photo_path", "is", null)).order("id")
    ),
    sb().from("lotto_entries").select("user_id, created_at").not("slot", "is", null),
  ]);
  const error = usersError || lottoError;
  if (error) throw new Error(`진행 현황을 불러오지 못했습니다: ${error.message}`);

  const photoCells = includeAllCells ? (cells || []).filter((cell) => cell.photo_path) : cells || [];
  const positionsByUser = new Map();
  // 마지막 인증 시각 — 관리자 목록을 "요즘 활동하는 사람" 순으로 세우는 데 쓴다.
  const lastUploadByUser = new Map();
  for (const c of photoCells) {
    if (!positionsByUser.has(c.user_id)) positionsByUser.set(c.user_id, []);
    positionsByUser.get(c.user_id).push(c.position);
    const previous = lastUploadByUser.get(c.user_id);
    if (c.uploaded_at && (!previous || c.uploaded_at > previous)) {
      lastUploadByUser.set(c.user_id, c.uploaded_at);
    }
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
      lastUploadAt: lastUploadByUser.get(u.id) || null,
    };
  });

  return {
    progress,
    users: users || [],
    cells: photoCells,
    allCells: includeAllCells ? cells || [] : photoCells,
    lotto: lotto || [],
  };
}

const PROGRESS_CACHE_TTL_MS = 5 * 1000;
let cachedProgress = null;
let progressRequest = null;

export async function getAllProgress({ cacheMs = 0, includeAllCells = false } = {}) {
  // Public feed responses can be reused briefly because every feed visitor otherwise
  // scans the same cells and lotto rows. Admin screens explicitly request fresh data.
  if (includeAllCells || cacheMs <= 0) return loadAllProgress(includeAllCells);

  const now = Date.now();
  if (cachedProgress && cachedProgress.expiresAt > now) return cachedProgress.value;
  if (progressRequest) return progressRequest;

  progressRequest = loadAllProgress(false)
    .then((value) => {
      cachedProgress = { value, expiresAt: Date.now() + Math.min(cacheMs, PROGRESS_CACHE_TTL_MS) };
      return value;
    })
    .finally(() => {
      progressRequest = null;
    });
  return progressRequest;
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

  const [{ progress, users, cells }, { data: awards, error: awardsError }] = await Promise.all([
    getAllProgress(),
    sb().from("four_line_awards").select("user_id, achieved_at, confirmed_at").order("achieved_at"),
  ]);
  // 확정 명단을 못 읽어도(마이그레이션 전 배포) 명예의 전당까지 죽이지는 않는다.
  // 그 경우 지금까지처럼 사진 기준으로 계산한 순위가 그대로 보인다.
  if (awardsError) console.error("[hall] four_line_awards not read", awardsError);

  const nicknameOf = new Map(users.map((user) => [user.id, user.nickname]));
  // 운영진이 확정한 사람은 확정 당시 순위로 고정한다. 공개 순위와 선물 명단이
  // 어긋나면 "왜 나는 3등인데 선물을 못 받냐"는 혼선이 생긴다.
  const fourLine = mergeFourLineAwards(fourLineAchievements(cells), (awards || []).map((award) => ({
    userId: award.user_id,
    achievedAt: award.achieved_at,
    confirmedAt: award.confirmed_at,
  })));
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
