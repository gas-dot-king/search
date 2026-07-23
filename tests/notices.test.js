import { describe, expect, it } from "vitest";
import { MAX_NOTICES, parseNotices } from "../lib/notices";

describe("parseNotices", () => {
  it("비어 있는 값은 빈 공지 목록으로 처리한다", () => {
    expect(parseNotices("")).toEqual([]);
    expect(parseNotices(null)).toEqual([]);
  });

  it("JSON 배열은 최대 공지 수까지만 반환한다", () => {
    const notices = Array.from({ length: MAX_NOTICES + 2 }, (_, index) => `공지 ${index + 1}`);
    expect(parseNotices(JSON.stringify(notices))).toEqual(notices.slice(0, MAX_NOTICES));
  });

  it("기존 단일 문자열 형식도 유지한다", () => {
    expect(parseNotices("기존 공지")).toEqual(["기존 공지"]);
    expect(parseNotices(JSON.stringify("JSON 단일 공지"))).toEqual(["JSON 단일 공지"]);
  });
});
