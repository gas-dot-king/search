import { describe, expect, it } from "vitest";
import { thumbPathFor } from "../lib/db";

// 축소본은 컬럼이 아니라 경로 규칙으로 찾는다. 규칙이 흔들리면 그리드가
// 조용히 원본을 내려받는 예전 동작으로 돌아가므로 여기서 고정해 둔다.
describe("그리드용 축소본 경로", () => {
  it("원본 경로 끝의 .jpg를 .thumb.jpg로 바꾼다", () => {
    expect(thumbPathFor("bingo/user-1/0-abc.jpg")).toBe("bingo/user-1/0-abc.thumb.jpg");
    expect(thumbPathFor("lotto/user-1/slot-1-abc.jpg")).toBe("lotto/user-1/slot-1-abc.thumb.jpg");
  });

  it("대문자 확장자도 같은 규칙을 따른다", () => {
    expect(thumbPathFor("bingo/user-1/3-abc.JPG")).toBe("bingo/user-1/3-abc.thumb.jpg");
  });

  it("경로 중간의 .jpg는 건드리지 않는다", () => {
    expect(thumbPathFor("bingo/my.jpg.photos/2-abc.jpg")).toBe("bingo/my.jpg.photos/2-abc.thumb.jpg");
  });

  it("빈 값이면 null — 사진 없는 칸에 그대로 넘겨도 안전하다", () => {
    expect(thumbPathFor(null)).toBe(null);
    expect(thumbPathFor("")).toBe(null);
    expect(thumbPathFor(undefined)).toBe(null);
  });

  it("두 번 적용해도 경로가 늘어나지 않는다", () => {
    const once = thumbPathFor("bingo/user-1/0-abc.jpg");
    expect(thumbPathFor(once)).toBe(once);
  });
});
