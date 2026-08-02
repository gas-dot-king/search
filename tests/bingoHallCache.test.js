import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// lib/progress.js는 Supabase를 직접 읽으므로, 시간당 집계가 실제로 DB 왕복을 줄이는지
// 확인하려면 조회 계층만 가짜로 세워야 한다. (다른 테스트는 순수 함수만 다룬다)
const db = vi.hoisted(() => {
  const state = { reads: 0, cells: [] };

  const resultFor = (table) => {
    if (table === "users") return { data: [{ id: "u1", nickname: "러닝왕", created_at: "2026-08-01T00:00:00Z" }], error: null };
    if (table === "cells") return { data: state.cells, error: null };
    return { data: [], error: null };
  };

  // select() 결과는 그대로 await 하기도 하고 .not()·.order()를 더 붙이기도 한다.
  const query = (table) => {
    const promise = Promise.resolve(resultFor(table));
    const builder = {
      not: () => builder,
      order: () => builder,
      then: (...args) => promise.then(...args),
    };
    return builder;
  };

  return {
    state,
    sb: () => ({
      from: (table) => {
        if (table === "users") state.reads += 1; // 집계 1회당 users를 한 번 읽는다
        return { select: () => query(table) };
      },
    }),
    // 실제 selectAllRows는 1000행씩 나눠 읽는다. 여기서는 한 번에 다 준다.
    selectAllRows: async (table) => (await resultFor(table)).data,
  };
});

vi.mock("../lib/db", () => ({ sb: db.sb, selectAllRows: db.selectAllRows }));

const { getBingoHallOfFame, invalidateBingoHallCache } = await import("../lib/progress");

const line = [0, 1, 2, 3].map((position) => ({ user_id: "u1", position, uploaded_at: "2026-08-02T01:00:00Z" }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-02T10:10:00+09:00"));
  db.state.reads = 0;
  db.state.cells = line;
  invalidateBingoHallCache();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("명예의 전당 빙고 집계 캐시", () => {
  it("같은 시간 안에서는 몇 번을 불러도 DB를 한 번만 읽는다", async () => {
    const first = await getBingoHallOfFame();
    vi.setSystemTime(new Date("2026-08-02T10:59:59+09:00"));
    const second = await getBingoHallOfFame();

    expect(db.state.reads).toBe(1);
    expect(second).toBe(first);
    expect(first.achievers).toEqual([
      { nickname: "러닝왕", lines: 1, filled: 4, complete: false, fourLineRank: null },
    ]);
  });

  it("한 시간이 지나면 다시 집계한다", async () => {
    await getBingoHallOfFame();
    vi.setSystemTime(new Date("2026-08-02T11:00:00+09:00"));
    db.state.cells = [...line, { user_id: "u1", position: 4, uploaded_at: "2026-08-02T02:00:00Z" }];
    const refreshed = await getBingoHallOfFame();

    expect(db.state.reads).toBe(2);
    expect(refreshed.achievers[0].filled).toBe(5);
  });

  it("집계 기준 시각을 함께 알려준다", async () => {
    const summary = await getBingoHallOfFame();
    expect(summary.updatedAt).toBe("2026-08-02T01:10:00.000Z");
  });

  it("관리자가 기록을 지우면 캐시를 버리고 다시 집계한다", async () => {
    await getBingoHallOfFame();
    db.state.cells = [];
    invalidateBingoHallCache();
    const refreshed = await getBingoHallOfFame();

    expect(db.state.reads).toBe(2);
    expect(refreshed.achievers).toEqual([]);
  });
});
