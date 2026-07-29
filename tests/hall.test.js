import { describe, expect, it } from "vitest";
import {
  CHALLENGE_AWARDS,
  FOUR_LINE_GOAL,
  SPONSORS,
  bingoHallOfFame,
  fourLineAchievements,
} from "../lib/hall";

// 4x4 빙고에서 가로 한 줄 = 4칸. 아래 테스트는 가로줄만 채워 줄 수를 늘린다.
const ROWS = [
  [0, 1, 2, 3],
  [4, 5, 6, 7],
  [8, 9, 10, 11],
  [12, 13, 14, 15],
];

/** 지정한 순서대로 칸을 채운 인증 기록을 만든다 */
function cellsFor(userId, positions, { start = 0, step = 1 } = {}) {
  return positions.map((position, index) => ({
    user_id: userId,
    position,
    uploaded_at: new Date(Date.UTC(2026, 7, 2, 0, start + index * step)).toISOString(),
  }));
}

// 가로 3줄(12칸) 다음 12번 칸을 채우면 세로 [0,4,8,12]와 대각 [3,6,9,12]가 한꺼번에 완성돼
// 3줄에서 5줄로 뛴다. 즉 마지막 칸이 4줄을 넘긴 칸이다.
const THREE_ROWS = [...ROWS[0], ...ROWS[1], ...ROWS[2]];
const TO_FOUR_LINES = [...THREE_ROWS, 12];

describe("후원자 명단", () => {
  it("닉네임만 남아 있다 (@ 표시나 뒤에 붙는 숫자 없이)", () => {
    for (const nickname of SPONSORS) {
      expect(nickname).toBe(nickname.trim());
      expect(nickname).not.toMatch(/[@/]/);
    }
  });

  it("같은 사람이 두 번 등재되지 않는다", () => {
    expect(new Set(SPONSORS).size).toBe(SPONSORS.length);
  });
});

describe("챌린지 수상자", () => {
  it("등록된 기록은 상 이름과 수상자를 모두 가진다", () => {
    for (const award of CHALLENGE_AWARDS) {
      expect(award.title).toBeTruthy();
      expect(award.nickname).toBeTruthy();
    }
  });
});

describe("4줄 달성 선착순", () => {
  it("4줄을 넘긴 칸의 인증 시각을 달성 시각으로 본다", () => {
    const cells = cellsFor("u1", TO_FOUR_LINES);
    const [achievement] = fourLineAchievements(cells);

    expect(achievement.userId).toBe("u1");
    expect(achievement.achievedAt).toBe(cells[cells.length - 1].uploaded_at);
    expect(achievement.rank).toBe(1);
  });

  it("나중에 더 채워도 달성 시각은 4줄을 만든 그 칸 그대로다", () => {
    const upToFour = cellsFor("u1", TO_FOUR_LINES);
    const later = cellsFor("u1", [13, 14, 15], { start: 90 });
    const [achievement] = fourLineAchievements([...upToFour, ...later]);

    expect(achievement.achievedAt).toBe(upToFour[upToFour.length - 1].uploaded_at);
  });

  it("3줄까지만 채운 사람은 명단에 없다", () => {
    // 가로 3줄(12칸)로는 세로줄·대각선이 하나도 완성되지 않는다
    expect(fourLineAchievements(cellsFor("u1", THREE_ROWS))).toEqual([]);
  });

  it("먼저 달성한 사람이 앞 순위로 온다 (인증이 뒤섞여 들어와도)", () => {
    const early = cellsFor("early", TO_FOUR_LINES, { start: 0 });
    const late = cellsFor("late", TO_FOUR_LINES, { start: 30 });
    const ranking = fourLineAchievements([...late, ...early]);

    expect(ranking.map((item) => item.userId)).toEqual(["early", "late"]);
    expect(ranking.map((item) => item.rank)).toEqual([1, 2]);
  });

  it("먼저 시작했어도 늦게 완성하면 뒷 순위다", () => {
    const slow = cellsFor("slow", TO_FOUR_LINES, { start: 0, step: 5 }); // 00:00 시작, 01:00 완성
    const quick = cellsFor("quick", TO_FOUR_LINES, { start: 10 }); // 00:10 시작, 00:22 완성
    const ranking = fourLineAchievements([...slow, ...quick]);

    expect(ranking.map((item) => item.userId)).toEqual(["quick", "slow"]);
  });

  it("같은 시각에 달성하면 순서를 고정해 매번 같은 순위를 준다", () => {
    const sameTime = (userId) =>
      TO_FOUR_LINES.map((position) => ({
        user_id: userId,
        position,
        uploaded_at: "2026-08-02T00:00:00.000Z",
      }));
    const first = fourLineAchievements([...sameTime("b"), ...sameTime("a")]);
    const second = fourLineAchievements([...sameTime("a"), ...sameTime("b")]);

    expect(first.map((item) => item.userId)).toEqual(["a", "b"]);
    expect(second).toEqual(first);
  });

  it("사진 없는 칸(uploaded_at 없음)은 세지 않는다", () => {
    // 4줄을 만든 마지막 칸의 사진이 지워지면 다시 3줄로 내려간다
    const cells = cellsFor("u1", TO_FOUR_LINES).map((cell, index, all) =>
      index === all.length - 1 ? { ...cell, uploaded_at: null } : cell
    );
    expect(fourLineAchievements(cells)).toEqual([]);
  });

  it("빈 입력에도 안전하다", () => {
    expect(fourLineAchievements([])).toEqual([]);
    expect(fourLineAchievements(undefined)).toEqual([]);
  });
});

describe("빙고 명예의 전당", () => {
  const progress = [
    { nickname: "가", filled: 16, lines: 10 },
    { nickname: "나", filled: 8, lines: 2 },
    { nickname: "다", filled: 12, lines: 2 },
    { nickname: "라", filled: 3, lines: 0 },
    { nickname: "마", filled: 0, lines: 0 },
  ];

  it("줄을 완성한 사람만 줄 수 → 칸 수 순으로 세운다", () => {
    const { achievers } = bingoHallOfFame(progress);
    expect(achievers.map((user) => user.nickname)).toEqual(["가", "다", "나"]);
    expect(achievers[0].complete).toBe(true);
    expect(achievers[1].complete).toBe(false);
  });

  it("참여자 수는 한 칸이라도 인증한 사람만 센다", () => {
    const summary = bingoHallOfFame(progress);
    expect(summary.participants).toBe(4);
    expect(summary.completed).toBe(1);
  });

  it("아직 아무도 인증하지 않아도 안전하게 빈 결과를 준다", () => {
    expect(bingoHallOfFame([])).toEqual({
      achievers: [],
      participants: 0,
      completed: 0,
      fourLineCount: 0,
    });
    expect(bingoHallOfFame(undefined).achievers).toEqual([]);
  });

  it("4줄 선착순 순위를 사람별 배지로 붙여 준다", () => {
    const withIds = [
      { id: "u1", nickname: "가", filled: 16, lines: 10 },
      { id: "u2", nickname: "나", filled: 8, lines: 2 },
    ];
    const summary = bingoHallOfFame(withIds, [{ userId: "u1", rank: 3 }]);

    expect(summary.achievers[0].fourLineRank).toBe(3);
    expect(summary.achievers[1].fourLineRank).toBeNull();
    expect(summary.fourLineCount).toBe(1); // 4줄 이상인 사람 수
  });

  it("4줄 미만은 목표 미달로 세지 않는다", () => {
    const summary = bingoHallOfFame([{ id: "u1", nickname: "가", filled: 12, lines: FOUR_LINE_GOAL - 1 }]);
    expect(summary.fourLineCount).toBe(0);
  });
});
