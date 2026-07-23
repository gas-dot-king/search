import { describe, expect, it } from "vitest";
import { countLines, DRAW_COUNTS, drawBoard } from "../lib/bingo";

function createItems() {
  return [
    ...Array.from({ length: 5 }, (_, index) => ({ id: 100 + index, category: 1 })),
    ...Array.from({ length: 7 }, (_, index) => ({ id: 200 + index, category: 2 })),
    ...Array.from({ length: 7 }, (_, index) => ({ id: 300 + index, category: 3 })),
  ];
}

describe("countLines", () => {
  it("완성된 가로와 세로 줄을 계산한다", () => {
    expect(countLines([])).toBe(0);
    expect(countLines([0, 1, 2, 3])).toBe(1);
    expect(countLines([0, 1, 2, 3, 4, 8, 12])).toBe(2);
  });

  it("16칸이 모두 채워지면 10줄을 계산한다", () => {
    expect(countLines(Array.from({ length: 16 }, (_, index) => index))).toBe(10);
  });
});

describe("drawBoard", () => {
  it("카테고리별 정해진 수만큼 중복 없이 16개를 뽑는다", () => {
    const items = createItems();
    const board = drawBoard(items);
    const categoryOf = new Map(items.map((item) => [item.id, item.category]));
    const counts = board.reduce((result, id) => {
      const category = categoryOf.get(id);
      result[category] = (result[category] || 0) + 1;
      return result;
    }, {});

    expect(board).toHaveLength(16);
    expect(new Set(board)).toHaveLength(16);
    expect(counts).toEqual(DRAW_COUNTS);
  });

  it("필요한 항목 수가 부족하면 뽑기를 중단한다", () => {
    const items = createItems().filter((item) => item.category !== 3 || item.id < 305);
    expect(() => drawBoard(items)).toThrow();
  });
});
