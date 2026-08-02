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
 * 어떤 빙고 항목이 많이/적게 인증됐는지.
 * 빙고판은 사람마다 무작위라 "몇 명 판에 있었는지"로 나눠야 공정하다.
 * 10명 판에 들어가 8명이 한 항목(80%)과, 40명 판에 들어가 8명이 한 항목(20%)은 다르다.
 *
 * @param cells 사진이 있는 칸 [{ item_id }]
 * @param allCells 사진 여부와 무관한 전체 칸 [{ item_id }] — 분모
 * @param items 빙고 항목 [{ id, category, content }]
 */
function itemStats(cells, allCells, items) {
  if (!items?.length) return [];
  const drawn = new Map();
  for (const cell of allCells || []) {
    if (cell?.item_id != null) drawn.set(cell.item_id, (drawn.get(cell.item_id) || 0) + 1);
  }
  const done = new Map();
  for (const cell of cells || []) {
    if (cell?.item_id != null) done.set(cell.item_id, (done.get(cell.item_id) || 0) + 1);
  }

  return items
    .map((item) => {
      const boards = drawn.get(item.id) || 0;
      const certified = done.get(item.id) || 0;
      return {
        id: item.id,
        category: item.category,
        content: item.content,
        boards,
        certified,
        rate: boards ? Math.round((certified / boards) * 1000) / 10 : 0,
      };
    })
    // 아무 판에도 안 뽑힌 항목은 비율이 의미 없어 맨 뒤로 보낸다.
    .sort((a, b) => b.rate - a.rate || b.certified - a.certified || a.content.localeCompare(b.content));
}

/**
 * 관리자 화면에 보여줄 전체 현황.
 * progress: [{ id, nickname, filled, lines, lottoEntries }]
 * cells:    사진이 있는 칸들 [{ user_id, position, item_id, uploaded_at }]
 * allCells: 사진 여부와 무관한 전체 칸 [{ item_id }] — 항목 통계의 분모
 * items:    빙고 항목 [{ id, category, content }]
 * lotto:    응모 [{ user_id, created_at }]
 */
export function buildEventStats(
  { progress = [], cells = [], lotto = [], allCells = [], items = [] } = {},
  now = new Date()
) {
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

  const perItem = itemStats(cells, allCells, items);

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
    perItem,
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
