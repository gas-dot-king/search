import { describe, expect, it } from "vitest";
import { demoAuth, demoBoard, demoDraw, demoUpload } from "../lib/demo";

describe("하루 빙고 인증 제한", () => {
  it("하루에 카테고리별 1칸, 총 3칸까지만 채운다", () => {
    const user = demoAuth("일일빙고테스트", "2468").user;
    demoDraw(user.id);
    const cells = demoBoard(user.id).cells;
    const one = cells.find((cell) => cell.category === 1);
    const two = cells.find((cell) => cell.category === 2);
    const three = cells.find((cell) => cell.category === 3);
    const anotherOne = cells.find((cell) => cell.category === 1 && cell.position !== one.position);
    const anotherTwo = cells.find((cell) => cell.category === 2 && cell.position !== two.position);

    expect(demoUpload(user.id, one.position)).toMatchObject({ ok: true });
    expect(demoUpload(user.id, anotherOne.position).error).toContain("같은 카테고리");
    expect(demoUpload(user.id, two.position)).toMatchObject({ ok: true });
    expect(demoUpload(user.id, three.position)).toMatchObject({ ok: true });
    expect(demoUpload(user.id, anotherTwo.position).error).toContain("최대 3칸");
  });

  it("오늘 이미 채운 같은 칸의 사진 교체는 허용한다", () => {
    const user = demoAuth("일일교체테스트", "8642").user;
    demoDraw(user.id);
    const first = demoBoard(user.id).cells.find((cell) => cell.category === 1);
    expect(demoUpload(user.id, first.position)).toMatchObject({ ok: true });
    expect(demoUpload(user.id, first.position)).toMatchObject({ ok: true });
  });
});
