import { describe, expect, it } from "vitest";
import {
  GUESTBOOK_MAX_LENGTH,
  guestbookMessageError,
  normalizeGuestbookMessage,
  readGuestbookMessage,
  sortGuestbookEntries,
} from "../lib/guestbook";

describe("방명록 메시지 다듬기", () => {
  it("앞뒤 공백을 없앤다", () => {
    expect(normalizeGuestbookMessage("  오늘 즐거웠어요  ")).toBe("오늘 즐거웠어요");
  });

  it("여러 줄 인사는 줄바꿈을 살린다", () => {
    expect(normalizeGuestbookMessage("첫째 줄\n둘째 줄")).toBe("첫째 줄\n둘째 줄");
  });

  it("윈도우 줄바꿈을 \\n으로 통일한다", () => {
    expect(normalizeGuestbookMessage("첫째\r\n둘째\r셋째")).toBe("첫째\n둘째\n셋째");
  });

  it("빈 줄 도배는 한 줄로 접는다", () => {
    expect(normalizeGuestbookMessage("위\n\n\n\n\n아래")).toBe("위\n\n아래");
  });

  it("줄 끝 공백만 지우고 줄 안쪽 공백은 둔다", () => {
    expect(normalizeGuestbookMessage("가 나   \n다 라")).toBe("가 나\n다 라");
  });

  it("공백뿐인 입력은 빈 문자열이 된다", () => {
    expect(normalizeGuestbookMessage("  \n\n \t ")).toBe("");
    expect(normalizeGuestbookMessage(null)).toBe("");
    expect(normalizeGuestbookMessage(undefined)).toBe("");
  });
});

describe("방명록 메시지 검증", () => {
  it("빈 글은 막는다", () => {
    expect(guestbookMessageError("")).toBe("방명록에 남길 내용을 입력해주세요.");
  });

  it("최대 길이까지는 통과한다", () => {
    expect(guestbookMessageError("가".repeat(GUESTBOOK_MAX_LENGTH))).toBe("");
  });

  it("최대 길이를 넘으면 막는다", () => {
    expect(guestbookMessageError("가".repeat(GUESTBOOK_MAX_LENGTH + 1))).toContain(
      String(GUESTBOOK_MAX_LENGTH)
    );
  });

  it("다듬은 뒤 길이로 판단한다", () => {
    const padded = `  ${"가".repeat(GUESTBOOK_MAX_LENGTH)}  `;
    expect(readGuestbookMessage(padded).error).toBe("");
    expect(readGuestbookMessage(padded).message).toHaveLength(GUESTBOOK_MAX_LENGTH);
  });

  it("공백만 보내면 빈 글로 걸러진다", () => {
    expect(readGuestbookMessage("   ").error).toBe("방명록에 남길 내용을 입력해주세요.");
  });
});

describe("방명록 정렬", () => {
  const entries = [
    { id: "b", createdAt: "2026-08-15T01:00:00Z" },
    { id: "a", createdAt: "2026-08-15T03:00:00Z" },
    { id: "c", createdAt: "2026-08-15T02:00:00Z" },
  ];

  it("최신 글이 위로 온다", () => {
    expect(sortGuestbookEntries(entries).map((e) => e.id)).toEqual(["a", "c", "b"]);
  });

  it("같은 시각이면 id로 순서가 흔들리지 않는다", () => {
    const tie = [
      { id: "z", createdAt: "2026-08-15T01:00:00Z" },
      { id: "y", createdAt: "2026-08-15T01:00:00Z" },
    ];
    expect(sortGuestbookEntries(tie).map((e) => e.id)).toEqual(["y", "z"]);
  });

  it("원본 배열을 바꾸지 않는다", () => {
    const original = [...entries];
    sortGuestbookEntries(entries);
    expect(entries).toEqual(original);
  });
});
