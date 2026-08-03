import { describe, expect, it } from "vitest";
import { FAQ_ITEMS } from "../lib/faq";

describe("FAQ", () => {
  it("운영 규칙을 묻는 질문과 답변을 제공한다", () => {
    expect(FAQ_ITEMS.length).toBeGreaterThanOrEqual(6);
    expect(FAQ_ITEMS[0].answer).toContain("하루 한 번");
    expect(FAQ_ITEMS[2].answer).toContain("하루 인증 횟수");
  });
});
