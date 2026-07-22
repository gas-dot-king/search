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

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * 카테고리별 5~6개(합 16개)를 뽑아 위치까지 섞은 빙고판을 만든다.
 * @param {Array<{id:number, category:number}>} items 전체 항목
 * @returns 16개 item id 배열 (index = 빙고판 position)
 */
export function drawBoard(items) {
  const byCat = { 1: [], 2: [], 3: [] };
  for (const it of items) byCat[it.category]?.push(it.id);

  // 한 카테고리만 6개, 나머지는 5개 (어느 쪽이 6개일지는 랜덤)
  const counts = [5, 5, 5];
  counts[Math.floor(Math.random() * 3)] = 6;

  const chosen = [];
  [1, 2, 3].forEach((cat, i) => {
    const pool = shuffle([...byCat[cat]]);
    if (pool.length < counts[i]) throw new Error(`카테고리 ${cat} 항목이 부족합니다.`);
    chosen.push(...pool.slice(0, counts[i]));
  });

  return shuffle(chosen);
}
