import { describe, expect, it } from "vitest";
import { dailyLimitMessage, todayInSeoul, CATEGORY_NAMES } from "../lib/bingo";

// "사진을 지웠는데 왜 다시 못 올리지?"가 실제로 나온 질문이다.
// 제한에 걸렸을 때 무엇이 막고 있는지 이름으로 짚어 주는지 확인한다.
describe("하루 인증 제한 안내", () => {
  it("같은 카테고리를 이미 썼으면 그 칸 이름과 해결 방법을 알려준다", () => {
    const message = dailyLimitMessage(
      [{ content: "5km 이상 달리기", category: 1 }],
      1
    );
    expect(message).toContain("5km 이상 달리기");
    expect(message).toContain(CATEGORY_NAMES[1]);
    expect(message).toContain("지우면");
  });

  it("하루 3칸을 다 썼으면 세 칸을 모두 알려준다", () => {
    const message = dailyLimitMessage(
      [
        { content: "5km 이상 달리기", category: 1 },
        { content: "주말에 한 번 달리기", category: 2 },
        { content: "러닝화 사진 인증하기", category: 3 },
      ],
      0
    );
    expect(message).toContain("5km 이상 달리기");
    expect(message).toContain("주말에 한 번 달리기");
    expect(message).toContain("러닝화 사진 인증하기");
    expect(message).toContain("내일");
  });

  it("카테고리 제한이 하루 3칸 제한보다 먼저 설명된다", () => {
    // 3칸을 다 썼고 그중 하나가 같은 카테고리면, 정확한 원인은 카테고리 쪽이다
    const message = dailyLimitMessage(
      [
        { content: "5km 이상 달리기", category: 1 },
        { content: "주말에 한 번 달리기", category: 2 },
        { content: "러닝화 사진 인증하기", category: 3 },
      ],
      2
    );
    expect(message).toContain("주말에 한 번 달리기");
    expect(message).toContain(CATEGORY_NAMES[2]);
    expect(message).not.toContain("내일");
  });

  it("목록을 못 읽었을 때도 안내는 나간다", () => {
    expect(dailyLimitMessage([], 1)).toContain("카테고리");
    expect(dailyLimitMessage(null, 0)).toContain("3칸");
    expect(dailyLimitMessage(undefined, 2)).toContain("카테고리");
  });

  it("내용이 빈 칸은 목록에서 뺀다", () => {
    const message = dailyLimitMessage(
      [{ content: "", category: 1 }, { content: "5km 이상 달리기", category: 1 }],
      1
    );
    expect(message).toContain("5km 이상 달리기");
    expect(message).not.toContain("''");
  });
});

describe("한국 날짜 기준", () => {
  it("UTC 자정 직후도 한국에서는 이미 다음 날이다", () => {
    // 2026-08-01 15:30 UTC = 2026-08-02 00:30 KST
    expect(todayInSeoul(new Date("2026-08-01T15:30:00Z"))).toBe("2026-08-02");
  });

  it("한국 시간 자정 직전은 아직 같은 날", () => {
    expect(todayInSeoul(new Date("2026-08-01T14:59:00Z"))).toBe("2026-08-01");
  });
});
