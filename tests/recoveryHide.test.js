import { describe, expect, it } from "vitest";
import {
  recoveryHideKey,
  RECOVERY_HIDE_DAY_MS,
  RECOVERY_HIDE_HOUR_MS,
  RECOVERY_PRIZE_NOTE,
  RECOVERY_STATES,
} from "../lib/recovery";

// 팝업을 닫아도 다시 뜨는 간격과, 상태별로 따로 세는 규칙을 고정한다.
describe("긴급 복구 팝업 숨김", () => {
  const event = { key: "server-overload-20260804" };

  it("공지와 복구 시작은 따로 센다 — 시작 사실은 한 번 더 알려야 한다", () => {
    const notice = recoveryHideKey(event, RECOVERY_STATES.NOTICE);
    const active = recoveryHideKey(event, RECOVERY_STATES.ACTIVE);
    expect(notice).not.toBe(active);
    expect(notice).toContain(event.key);
  });

  it("이벤트가 바뀌면 키도 바뀐다", () => {
    expect(recoveryHideKey({ key: "a" }, RECOVERY_STATES.NOTICE))
      .not.toBe(recoveryHideKey({ key: "b" }, RECOVERY_STATES.NOTICE));
  });

  it("이벤트가 없어도 키를 만든다", () => {
    expect(recoveryHideKey(null, RECOVERY_STATES.NOTICE)).toBeTruthy();
    expect(recoveryHideKey(undefined, RECOVERY_STATES.ACTIVE)).toBeTruthy();
  });

  it("긴 키는 잘라서 저장소 키가 비대해지지 않게 한다", () => {
    const key = recoveryHideKey({ key: "가".repeat(300) }, RECOVERY_STATES.NOTICE);
    expect(key.length).toBeLessThan(140);
  });

  it("닫기는 1시간, 하루 끄기는 24시간", () => {
    expect(RECOVERY_HIDE_HOUR_MS).toBe(60 * 60 * 1000);
    expect(RECOVERY_HIDE_DAY_MS).toBe(24 * RECOVERY_HIDE_HOUR_MS);
  });
});

describe("상품 안내", () => {
  it("커피 쿠폰을 알린다", () => {
    expect(RECOVERY_PRIZE_NOTE).toContain("커피 쿠폰");
  });
});
