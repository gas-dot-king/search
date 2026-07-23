import { describe, expect, it } from "vitest";
import { computeWinners, matchCount } from "../lib/lotto";

describe("matchCount", () => {
  it("같은 위치의 숫자만 일치로 계산한다", () => {
    expect(matchCount("0524", "0524")).toBe(4);
    expect(matchCount("0520", "0524")).toBe(3);
    expect(matchCount("4250", "0524")).toBe(0);
  });
});

describe("computeWinners", () => {
  it("참가자별 최고 기록만 남기고 2자리 이상 일치자만 반환한다", () => {
    const winners = computeWinners(
      [
        { digits: "0500", users: { nickname: "alice" } },
        { digits: "0524", users: { nickname: "alice" } },
        { digits: "0520", users: { nickname: "bob" } },
        { digits: "0000", users: { nickname: "carol" } },
      ],
      "0524"
    );

    expect(winners).toEqual([
      { nickname: "alice", digits: "0524", matches: 4 },
      { nickname: "bob", digits: "0520", matches: 3 },
    ]);
  });
});
