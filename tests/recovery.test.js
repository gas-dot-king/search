import { describe, expect, it } from "vitest";
import {
  DEFAULT_RECOVERY_EVENT,
  normalizeRecoveryEvent,
  recoveryState,
  recoveryTicketDigit,
  recoveryTicketLabel,
  RECOVERY_STATES,
} from "../lib/recovery";

describe("긴급 복구 이벤트", () => {
  it("공지·복구·종료 시각을 한국 시간 기준으로 구분한다", () => {
    expect(recoveryState(DEFAULT_RECOVERY_EVENT, new Date("2026-08-03T17:59:59+09:00"))).toBe(RECOVERY_STATES.BEFORE_NOTICE);
    expect(recoveryState(DEFAULT_RECOVERY_EVENT, new Date("2026-08-03T18:00:00+09:00"))).toBe(RECOVERY_STATES.NOTICE);
    expect(recoveryState(DEFAULT_RECOVERY_EVENT, new Date("2026-08-04T00:00:00+09:00"))).toBe(RECOVERY_STATES.ACTIVE);
    expect(recoveryState(DEFAULT_RECOVERY_EVENT, new Date("2026-08-05T00:00:00+09:00"))).toBe(RECOVERY_STATES.ENDED);
  });

  it("잘못된 설정은 안전한 기본값으로 정규화한다", () => {
    const value = normalizeRecoveryEvent({ enabled: false, winningDigit: "99", endAt: "invalid" });
    expect(value.enabled).toBe(false);
    expect(value.winningDigit).toBe("");
    expect(value.startAt).toBe(DEFAULT_RECOVERY_EVENT.startAt);
  });

  it("접수번호의 끝자리와 표시용 티켓을 만든다", () => {
    expect(recoveryTicketDigit(1047)).toBe(7);
    expect(recoveryTicketLabel(1047)).toBe("YSRC-RCV-1047");
  });
});
