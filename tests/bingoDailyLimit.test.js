import { describe, expect, it } from "vitest";
import { demoAuth, demoBoard, demoDraw, demoRemoveUpload, demoUpload } from "../lib/demo";

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
    // 안내는 무엇이 막고 있는지 칸 이름으로 짚어 준다
    expect(demoUpload(user.id, anotherOne.position).error).toContain(one.content);
    expect(demoUpload(user.id, two.position)).toMatchObject({ ok: true });
    expect(demoUpload(user.id, three.position)).toMatchObject({ ok: true });
    expect(demoUpload(user.id, anotherTwo.position).error).toContain(two.content);
  });

  it("사진을 지우면 그 칸에 다시 올릴 수 있다", () => {
    const user = demoAuth("삭제후재업로드", "1357").user;
    demoDraw(user.id);
    const cells = demoBoard(user.id).cells;
    const one = cells.find((cell) => cell.category === 1);
    const two = cells.find((cell) => cell.category === 2);
    const three = cells.find((cell) => cell.category === 3);

    // 하루 3칸을 다 쓴 뒤 한 칸을 지우면, 그 칸에는 다시 올라가야 한다
    expect(demoUpload(user.id, one.position)).toMatchObject({ ok: true });
    expect(demoUpload(user.id, two.position)).toMatchObject({ ok: true });
    expect(demoUpload(user.id, three.position)).toMatchObject({ ok: true });
    expect(demoRemoveUpload(user.id, two.position)).toMatchObject({ ok: true });
    expect(demoUpload(user.id, two.position)).toMatchObject({ ok: true });
  });

  it("오늘 이미 채운 같은 칸의 사진 교체는 허용한다", () => {
    const user = demoAuth("일일교체테스트", "8642").user;
    demoDraw(user.id);
    const first = demoBoard(user.id).cells.find((cell) => cell.category === 1);
    expect(demoUpload(user.id, first.position)).toMatchObject({ ok: true });
    expect(demoUpload(user.id, first.position)).toMatchObject({ ok: true });
  });
});
