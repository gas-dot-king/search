import { describe, expect, it } from "vitest";
import { buildEventStats } from "../lib/stats";

// 이벤트 중간 점검 화면의 숫자들. 한국 시간 기준 "오늘"이 특히 틀리기 쉬워 함께 고정한다.
const NOW = new Date("2026-08-03T05:00:00Z"); // 한국 시간 8/3 14:00

const cellAt = (userId, position, iso, itemId = position + 1) => ({
  user_id: userId,
  position,
  item_id: itemId,
  uploaded_at: iso,
});

describe("전체 현황 집계", () => {
  const progress = [
    { id: "u1", nickname: "가", filled: 5, lines: 1, lottoEntries: 2 },
    { id: "u2", nickname: "나", filled: 16, lines: 4, lottoEntries: 1 },
    { id: "u3", nickname: "다", filled: 0, lines: 0, lottoEntries: 0 },
  ];
  const cells = [
    ...Array.from({ length: 5 }, (_, i) => cellAt("u1", i, "2026-08-02T02:00:00Z")),
    ...Array.from({ length: 16 }, (_, i) => cellAt("u2", i, "2026-08-03T01:00:00Z")),
  ];
  const lotto = [
    { user_id: "u1", created_at: "2026-08-01T00:00:00Z" },
    { user_id: "u1", created_at: "2026-08-03T02:00:00Z" },
    { user_id: "u2", created_at: "2026-08-02T00:00:00Z" },
  ];
  const stats = buildEventStats({ progress, cells, lotto }, NOW);

  it("참여 인원을 나눠서 센다", () => {
    expect(stats.members).toBe(3);
    expect(stats.started).toBe(2);
    expect(stats.idle).toBe(1); // 한 장도 안 올린 사람
    expect(stats.completed).toBe(1); // 16칸 완성
  });

  it("사진 수와 오늘 올라온 수를 센다", () => {
    expect(stats.photos).toBe(21);
    expect(stats.photosToday).toBe(16); // 한국 시간 8/3에 올라온 것만
  });

  it("평균과 채움 비율을 낸다", () => {
    expect(stats.avgFilled).toBe(7); // 21장 / 3명
    expect(stats.fillRate).toBe(43.8); // 21 / (3 * 16)
  });

  it("빙고 줄 현황을 낸다", () => {
    expect(stats.totalLines).toBe(5);
    expect(stats.withLine).toBe(2);
    expect(stats.fourLine).toBe(1);
  });

  it("로또 응모를 사람 수와 장수로 나눠 센다", () => {
    expect(stats.lottoEntries).toBe(3);
    expect(stats.lottoMembers).toBe(2);
    expect(stats.lottoFull).toBe(1); // 2장 다 쓴 사람
    expect(stats.lottoToday).toBe(1);
  });

  it("최근 7일 추이를 오래된 날부터 오늘까지 만든다", () => {
    expect(stats.daily).toHaveLength(7);
    expect(stats.daily.at(-1).isToday).toBe(true);
    expect(stats.daily.at(-1).day).toBe("2026-08-03");
    expect(stats.daily.at(-1).count).toBe(16);
    expect(stats.daily.at(-2).count).toBe(5); // 8/2
    expect(stats.daily.filter((d) => d.isToday)).toHaveLength(1);
  });

});

describe("항목별 인증률", () => {
  // 항목 1은 세 명 판에 다 뽑혔지만 두 명만 인증했고,
  // 항목 2는 한 명 판에만 뽑혀 그 한 명이 인증했다 — 비율로 봐야 공정하다.
  const items = [
    { id: 1, category: 1, content: "5km 이상 달리기" },
    { id: 2, category: 2, content: "새벽 러닝" },
    { id: 3, category: 3, content: "러닝화 사진" },
  ];
  const allCells = [
    { item_id: 1 }, { item_id: 1 }, { item_id: 1 },
    { item_id: 2 },
    { item_id: 3 }, { item_id: 3 },
  ];
  const cells = [
    cellAt("u1", 0, "2026-08-03T01:00:00Z", 1),
    cellAt("u2", 0, "2026-08-03T01:00:00Z", 1),
    cellAt("u3", 1, "2026-08-03T01:00:00Z", 2),
  ];
  const stats = buildEventStats({ cells, allCells, items }, NOW);

  it("뽑힌 판 수를 분모로 인증률을 낸다", () => {
    const byId = new Map(stats.perItem.map((item) => [item.id, item]));
    expect(byId.get(1)).toMatchObject({ boards: 3, certified: 2, rate: 66.7 });
    expect(byId.get(2)).toMatchObject({ boards: 1, certified: 1, rate: 100 });
    expect(byId.get(3)).toMatchObject({ boards: 2, certified: 0, rate: 0 });
  });

  it("인증률이 높은 항목부터 세운다", () => {
    expect(stats.perItem.map((item) => item.id)).toEqual([2, 1, 3]);
  });

  it("항목 목록이 없으면 빈 배열이라 화면이 그냥 비어 보인다", () => {
    expect(buildEventStats({ cells, allCells }, NOW).perItem).toEqual([]);
  });
});

describe("빈 이벤트와 이상한 값", () => {
  it("아무도 없을 때 0으로 나오고 나눗셈이 깨지지 않는다", () => {
    const stats = buildEventStats({}, NOW);
    expect(stats.members).toBe(0);
    expect(stats.avgFilled).toBe(0);
    expect(stats.fillRate).toBe(0);
    expect(stats.daily).toHaveLength(7);
    expect(stats.daily.every((d) => d.count === 0)).toBe(true);
  });

  it("업로드 시각이 없거나 깨져도 무너지지 않는다", () => {
    const stats = buildEventStats({
      progress: [{ id: "u1", filled: 1, lines: 0, lottoEntries: 0 }],
      cells: [cellAt("u1", 0, null), cellAt("u1", 1, "언제였더라"), { user_id: "u1", position: 99 }],
    }, NOW);
    expect(stats.photos).toBe(3);
    expect(stats.photosToday).toBe(0);
    expect(stats.perItem).toEqual([]); // 항목 목록 없이도 무너지지 않는다
  });
});
