import { countLines, todayInSeoul, LINES } from "./bingo";

// 이벤트가 도는 동안 운영진이 "지금 어디쯤 왔나"를 한눈에 보기 위한 집계.
// 서버에서 계산해 숫자만 내려보낸다 — 회원 수백 명분 원본을 화면으로 보내지 않는다.

const BOARD_CELLS = 16;
const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_DAYS = 7;

function seoulDate(value, now) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return todayInSeoul(date);
}

/** 최근 며칠간 하루에 몇 장씩 올라왔는지 (오래된 날 → 오늘 순) */
function dailyCounts(cells, now) {
  const today = todayInSeoul(now);
  const days = [];
  for (let back = RECENT_DAYS - 1; back >= 0; back -= 1) {
    days.push(todayInSeoul(new Date(now.getTime() - back * DAY_MS)));
  }
  const counts = new Map(days.map((day) => [day, 0]));
  for (const cell of cells || []) {
    const day = seoulDate(cell.uploaded_at, now);
    if (day && counts.has(day)) counts.set(day, counts.get(day) + 1);
  }
  return days.map((day) => ({
    day,
    label: `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`,
    count: counts.get(day) || 0,
    isToday: day === today,
  }));
}

/**
 * 관리자 화면에 보여줄 전체 현황.
 * progress: [{ id, nickname, filled, lines, lottoEntries }]
 * cells:    사진이 있는 칸들 [{ user_id, position, uploaded_at }]
 * lotto:    응모 [{ user_id, created_at }]
 */
export function buildEventStats({ progress = [], cells = [], lotto = [] } = {}, now = new Date()) {
  const today = todayInSeoul(now);

  const members = progress.length;
  const started = progress.filter((user) => user.filled > 0).length;
  const idle = members - started;
  const completed = progress.filter((user) => user.filled >= BOARD_CELLS).length;

  const photos = cells.length;
  const photosToday = (cells || []).filter((cell) => seoulDate(cell.uploaded_at, now) === today).length;

  // 줄 수는 사람마다 이미 계산돼 있지만, 목표(4줄) 도달 인원은 따로 센다
  const withLine = progress.filter((user) => user.lines >= 1).length;
  const fourLine = progress.filter((user) => user.lines >= 4).length;
  const totalLines = progress.reduce((sum, user) => sum + (user.lines || 0), 0);

  const lottoEntries = lotto.length;
  const lottoMembers = new Set((lotto || []).map((entry) => entry.user_id)).size;
  const lottoFull = progress.filter((user) => (user.lottoEntries || 0) >= 2).length;
  const lottoToday = (lotto || []).filter((entry) => seoulDate(entry.created_at, now) === today).length;

  // 어느 칸이 인기 있는지 — 칸 위치별 인증 수 (빙고판이 사람마다 달라 위치로만 본다)
  const perPosition = Array.from({ length: BOARD_CELLS }, () => 0);
  for (const cell of cells || []) {
    if (Number.isInteger(cell.position) && cell.position >= 0 && cell.position < BOARD_CELLS) {
      perPosition[cell.position] += 1;
    }
  }

  return {
    members,
    started,
    idle,
    completed,
    photos,
    photosToday,
    avgFilled: members ? Math.round((photos / members) * 10) / 10 : 0,
    fillRate: members ? Math.round((photos / (members * BOARD_CELLS)) * 1000) / 10 : 0,
    withLine,
    fourLine,
    totalLines,
    lottoEntries,
    lottoMembers,
    lottoFull,
    lottoToday,
    daily: dailyCounts(cells, now),
    perPosition,
    boardCells: BOARD_CELLS,
    totalLinePaths: LINES.length,
    updatedAt: now.toISOString(),
  };
}

/** 진행 목록만 있고 원본 칸이 없을 때(데모 등) 쓰는 안전한 기본값 */
export function emptyStats(now = new Date()) {
  return buildEventStats({}, now);
}

export { countLines };
