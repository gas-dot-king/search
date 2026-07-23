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
