import { describe, expect, it } from "vitest";
import {
  recoveryHideKey,
  RECOVERY_HIDE_HOUR_MS,
  RECOVERY_PRIZE_NOTE,
} from "../lib/recovery";

// 팝업을 닫아도 다시 뜨는 간격과 이벤트별 숨김 키를 고정한다.
describe("긴급 복구 팝업 숨김", () => {
  const event = { key: "server-overload-20260804" };

  it("이벤트별로 숨김 상태를 저장한다", () => {
    const key = recoveryHideKey(event);
    expect(key).toContain(event.key);
    expect(key).toBe(recoveryHideKey(event));
  });

  it("이벤트가 바뀌면 키도 바뀐다", () => {
    expect(recoveryHideKey({ key: "a" })).not.toBe(recoveryHideKey({ key: "b" }));
  });

  it("이벤트가 없어도 키를 만든다", () => {
    expect(recoveryHideKey(null)).toBeTruthy();
    expect(recoveryHideKey(undefined)).toBeTruthy();
  });

  it("긴 키는 잘라서 저장소 키가 비대해지지 않게 한다", () => {
    const key = recoveryHideKey({ key: "가".repeat(300) });
    expect(key.length).toBeLessThan(140);
  });

  it("닫기 간격은 1시간이다", () => {
    expect(RECOVERY_HIDE_HOUR_MS).toBe(60 * 60 * 1000);
  });
});

describe("상품 안내", () => {
  it("커피 쿠폰을 알린다", () => {
    expect(RECOVERY_PRIZE_NOTE).toContain("커피 쿠폰");
  });
});
