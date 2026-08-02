import { describe, expect, it } from "vitest";
import { decodeRecentCursor, encodeRecentCursor } from "../lib/adminCursor";

describe("관리자 검토 큐 커서", () => {
  it("동일한 촬영 시각과 id를 보존한다", () => {
    const row = { uploaded_at: "2026-08-01T01:02:03.000Z", id: "abc-123" };
    expect(decodeRecentCursor(encodeRecentCursor(row))).toEqual({ at: row.uploaded_at, id: row.id });
  });

  it("이전 timestamp 커서를 한시적으로 읽는다", () => {
    expect(decodeRecentCursor("2026-08-01T01:02:03.000Z")).toEqual({
      at: "2026-08-01T01:02:03.000Z",
      id: null,
    });
  });

  it("쿼리 주입에 사용할 수 있는 커서는 버린다", () => {
    expect(decodeRecentCursor(encodeRecentCursor({
      uploaded_at: "2026-08-01T01:02:03.000Z",
      id: "abc,or.id.eq.secret",
    }))).toBeNull();
  });
});
