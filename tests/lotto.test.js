import { describe, expect, it } from "vitest";
import {
  computeWinners,
  currentLottoRound,
  entryDrawDigits,
  LOTTO_ENTRY_LIMIT,
  MAX_LOTTO_ROUNDS,
  matchCount,
  parseLottoRounds,
  serializeLottoRounds,
} from "../lib/lotto";

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

  it("세 자리를 맞춘 사람이 없으면 빈 명단 — 다음 차수로 넘어간다", () => {
    const winners = computeWinners([{ digits: "0520", users: { nickname: "bob" } }], "524");
    expect(winners).toEqual([]);
  });
});

describe("추첨 차수", () => {
  it("지난 차수가 없으면 1차", () => {
    expect(currentLottoRound("")).toBe(1);
    expect(currentLottoRound(null)).toBe(1);
    expect(currentLottoRound("[]")).toBe(1);
  });

  it("1등 없이 넘어간 차수만큼 차수가 올라간다", () => {
    expect(currentLottoRound(["010", "473"])).toBe(3);
    expect(currentLottoRound('["010","473"]')).toBe(3);
  });

  it("3자리 숫자가 아닌 값은 차수로 세지 않는다", () => {
    expect(parseLottoRounds(["010", "12", "abc", "1234", "", null])).toEqual(["010"]);
    expect(parseLottoRounds("깨진값")).toEqual([]);
  });

  it("차수는 정해진 개수까지만 남긴다", () => {
    const many = Array.from({ length: MAX_LOTTO_ROUNDS + 5 }, () => "123");
    expect(parseLottoRounds(many)).toHaveLength(MAX_LOTTO_ROUNDS);
  });

  it("저장했다 읽어도 같은 목록이다", () => {
    expect(parseLottoRounds(serializeLottoRounds(["010", "473"]))).toEqual(["010", "473"]);
  });
});
