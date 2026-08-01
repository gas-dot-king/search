/** 4x4 빙고 줄 정의: 가로4 + 세로4 + 대각선2 = 10줄 */
export const LINES = [
  [0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11], [12, 13, 14, 15],
  [0, 4, 8, 12], [1, 5, 9, 13], [2, 6, 10, 14], [3, 7, 11, 15],
  [0, 5, 10, 15], [3, 6, 9, 12],
];

export function countLines(filledPositions) {
  const s = new Set(filledPositions);
  return LINES.filter((line) => line.every((p) => s.has(p))).length;
}

/** 한 칸만 더 채우면 완성되는 줄을 반환합니다. */
export function getNearCompleteLines(filledPositions) {
  const filled = new Set(filledPositions);
  return LINES.filter((line) => line.filter((position) => filled.has(position)).length === 3);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 카테고리별 뽑는 개수 (합 16) */
export const DRAW_COUNTS = { 1: 4, 2: 6, 3: 6 };

export const DAILY_CELL_LIMIT = 3;
export const CATEGORY_NAMES = { 1: "기록 달성", 2: "시간·장소 탐험", 3: "크루 소통·재미" };

/** 오늘 인증한 칸 목록에서 한국 날짜 문자열을 구한다 (제한은 한국 시간 기준) */
export function todayInSeoul(now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(now);
}

/**
 * 하루 제한에 걸렸을 때, 무엇이 막고 있고 어떻게 하면 되는지까지 알려준다.
 * "이미 지웠는데 왜 안 되지?"에 답하려면 막는 칸의 이름을 짚어 줘야 한다.
 * todayCells: 오늘 인증된 칸들 [{ content, category }]
 */
export function dailyLimitMessage(todayCells, category) {
  const cells = (todayCells || []).filter((c) => c && c.content);
  const sameCategory = cells.filter((c) => c.category === category);

  // 사진을 지워도 그 칸이 오늘 자리를 계속 차지하므로, "지우면 된다"고 안내하면 안 된다.
  // 오늘은 그 칸으로 이어가고, 다른 칸으로 옮기는 건 내일부터 가능하다.
  if (sameCategory.length > 0) {
    const names = sameCategory.map((c) => `'${c.content}'`).join(", ");
    const label = CATEGORY_NAMES[category] || "같은";
    return `오늘은 ${names} 칸으로 [${label}] 카테고리를 인증했어요. `
      + `카테고리마다 하루 1칸이라, 오늘은 그 칸에 사진을 다시 올려 바꾸고 `
      + `이 칸은 내일 인증해주세요.`;
  }

  if (cells.length >= DAILY_CELL_LIMIT) {
    const names = cells.map((c) => `'${c.content}'`).join(", ");
    return `오늘은 이미 ${DAILY_CELL_LIMIT}칸(${names})을 인증했어요. `
      + `하루 ${DAILY_CELL_LIMIT}칸까지라, 이 칸은 내일 인증해주세요. `
      + `이미 인증한 칸의 사진은 오늘도 얼마든지 바꿀 수 있어요.`;
  }

  // 목록을 못 읽었을 때를 위한 기본 문구
  return category
    ? `하루에는 같은 카테고리를 1칸만 인증할 수 있어요.`
    : `하루에는 빙고를 최대 ${DAILY_CELL_LIMIT}칸까지만 인증할 수 있어요.`;
}

/**
 * 카테고리별 ①4 / ②6 / ③6개(합 16개)를 뽑아 위치까지 섞은 빙고판을 만든다.
 * @param {Array<{id:number, category:number}>} items 전체 항목
 * @returns 16개 item id 배열 (index = 빙고판 position)
 */
export function drawBoard(items) {
  const byCat = { 1: [], 2: [], 3: [] };
  for (const it of items) byCat[it.category]?.push(it.id);

  const chosen = [];
  for (const cat of [1, 2, 3]) {
    const pool = shuffle([...byCat[cat]]);
    if (pool.length < DRAW_COUNTS[cat]) throw new Error(`카테고리 ${cat} 항목이 부족합니다.`);
    chosen.push(...pool.slice(0, DRAW_COUNTS[cat]));
  }

  return shuffle(chosen);
}
