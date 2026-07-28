import { describe, expect, it } from "vitest";
import { computeWinners, entryDrawDigits, LOTTO_ENTRY_LIMIT, matchCount } from "../lib/lotto";

describe("lotto entries", () => {
  it("한 사람당 두 장까지 응모할 수 있다", () => {
    expect(LOTTO_ENTRY_LIMIT).toBe(2);
  });
});

describe("matchCount", () => {
  it("1의 자리와 소수점 두 자리만 추첨 번호와 비교한다", () => {
    expect(entryDrawDigits("0524")).toBe("524");
    expect(matchCount("0524", "524")).toBe(3);
    expect(matchCount("0520", "524")).toBe(2);
    expect(matchCount("0420", "524")).toBe(1);
  });
});

describe("computeWinners", () => {
  it("참가자별 최고 기록 중 세 자리 모두 일치한 1등만 반환한다", () => {
    const winners = computeWinners(
      [
        { digits: "0500", users: { nickname: "alice" } },
        { digits: "0524", users: { nickname: "alice" } },
        { digits: "0520", users: { nickname: "bob" } },
        { digits: "0000", users: { nickname: "carol" } },
      ],
      "524"
    );

    expect(winners).toEqual([
      { nickname: "alice", digits: "0524", matches: 3 },
    ]);
  });
});
