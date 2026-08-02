import { describe, expect, it } from "vitest";
import { mergeFourLineAwards } from "../lib/hall";

// 선물 20명이 걸린 순위라, 확정한 뒤에는 사진을 바꿔도 흔들리지 않아야 한다.
const live = (userId, achievedAt) => ({ userId, achievedAt });
const award = (userId, achievedAt) => ({
  userId,
  achievedAt,
  confirmedAt: "2026-08-05T00:00:00Z",
});

describe("4줄 확정 명단 합치기", () => {
  it("확정이 하나도 없으면 지금 계산한 순서 그대로다", () => {
    const merged = mergeFourLineAwards([
      live("u2", "2026-08-02T10:00:00Z"),
      live("u1", "2026-08-01T10:00:00Z"),
    ]);
    expect(merged.map((row) => [row.userId, row.rank])).toEqual([["u1", 1], ["u2", 2]]);
    expect(merged.every((row) => row.confirmed === false)).toBe(true);
  });

  // 이게 이 기능의 존재 이유다: 1등이 사진을 바꿔 달성 시각이 뒤로 밀려도 1등이어야 한다.
  it("확정한 사람은 사진을 바꿔도 순위가 밀리지 않는다", () => {
    const merged = mergeFourLineAwards(
      [
        live("u1", "2026-08-04T10:00:00Z"), // 사진 교체로 시각이 뒤로 밀렸다
        live("u2", "2026-08-02T10:00:00Z"),
      ],
      [award("u1", "2026-08-01T10:00:00Z")] // 확정 당시엔 8/1이었다
    );
    expect(merged.map((row) => row.userId)).toEqual(["u1", "u2"]);
    expect(merged[0].rank).toBe(1);
    expect(merged[0].achievedAt).toBe("2026-08-01T10:00:00Z");
  });

  it("확정 뒤 사진이 바뀌면 현재 시각을 따로 알려 준다", () => {
    const [row] = mergeFourLineAwards(
      [live("u1", "2026-08-04T10:00:00Z")],
      [award("u1", "2026-08-01T10:00:00Z")]
    );
    expect(row.confirmed).toBe(true);
    expect(row.achievedAt).toBe("2026-08-01T10:00:00Z");
    expect(row.liveAchievedAt).toBe("2026-08-04T10:00:00Z");
    expect(row.stillQualifies).toBe(true);
  });

  it("확정한 사람이 사진을 지워 4줄이 깨지면 표시해 준다", () => {
    const [row] = mergeFourLineAwards([], [award("u1", "2026-08-01T10:00:00Z")]);
    expect(row.stillQualifies).toBe(false);
    expect(row.liveAchievedAt).toBeNull();
    expect(row.rank).toBe(1); // 명단에는 남는다 — 지울지는 운영진이 정한다
  });

  it("확정한 순서가 아니라 달성 시각으로 순위를 매긴다", () => {
    // 운영진이 u2를 먼저 확정했어도, 더 일찍 달성한 u1이 1등이다
    const merged = mergeFourLineAwards(
      [live("u1", "2026-08-01T10:00:00Z"), live("u2", "2026-08-02T10:00:00Z")],
      [award("u2", "2026-08-02T10:00:00Z"), award("u1", "2026-08-01T10:00:00Z")]
    );
    expect(merged.map((row) => row.userId)).toEqual(["u1", "u2"]);
  });

  it("확정된 사람과 아직 안 된 사람을 시각 순으로 섞는다", () => {
    const merged = mergeFourLineAwards(
      [
        live("u1", "2026-08-01T10:00:00Z"),
        live("u2", "2026-08-02T10:00:00Z"),
        live("u3", "2026-08-03T10:00:00Z"),
      ],
      [award("u2", "2026-08-02T10:00:00Z")]
    );
    expect(merged.map((row) => [row.userId, row.confirmed])).toEqual([
      ["u1", false],
      ["u2", true],
      ["u3", false],
    ]);
  });

  it("같은 시각이면 회원 id로 순서를 고정해 다시 계산해도 안 흔들린다", () => {
    const at = "2026-08-01T10:00:00Z";
    const first = mergeFourLineAwards([live("ub", at), live("ua", at)]);
    const second = mergeFourLineAwards([live("ua", at), live("ub", at)]);
    expect(first.map((row) => row.userId)).toEqual(["ua", "ub"]);
    expect(second.map((row) => row.userId)).toEqual(first.map((row) => row.userId));
  });

  it("아무도 없으면 빈 배열", () => {
    expect(mergeFourLineAwards([], [])).toEqual([]);
    expect(mergeFourLineAwards()).toEqual([]);
  });
});
