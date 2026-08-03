import { describe, expect, it } from "vitest";
import { isRecoveryGatedPath as isGatedPath, msUntilRecoveryChange } from "../lib/recovery";

// 복구 중에 어디를 잠글지. 인증과 무관한 화면까지 막으면 문의 창구가 사라진다.
describe("복구 중 복구센터로 보낼 화면", () => {
  it("빙고·로또·챌린지·행사·뽑기·피드는 보낸다", () => {
    for (const path of ["/board", "/lotto", "/challenge", "/event", "/draw", "/feed"]) {
      expect(isGatedPath(path)).toBe(true);
    }
  });

  it("복구센터 자신과 입장 화면은 두어야 한다 — 안 그러면 무한 이동", () => {
    expect(isGatedPath("/recovery")).toBe(false);
    expect(isGatedPath("/")).toBe(false);
  });

  it("설정·FAQ·명예의 전당·관리자는 열어 둔다", () => {
    for (const path of ["/settings", "/faq", "/hall", "/admin"]) {
      expect(isGatedPath(path)).toBe(false);
    }
  });

  it("하위 경로도 함께 막는다", () => {
    expect(isGatedPath("/board/anything")).toBe(true);
    expect(isGatedPath("/admin/draw")).toBe(false);
  });

  it("이름이 비슷한 다른 경로를 잘못 막지 않는다", () => {
    expect(isGatedPath("/boardgame")).toBe(false);
    expect(isGatedPath("/events")).toBe(false);
  });

  it("경로가 없어도 무너지지 않는다", () => {
    expect(isGatedPath(null)).toBe(false);
    expect(isGatedPath(undefined)).toBe(false);
    expect(isGatedPath("")).toBe(false);
  });
});

// 매초 확인하는 대신 상태가 바뀌는 시각에만 깨어난다.
describe("다음 상태 변화까지 남은 시간", () => {
  const event = {
    key: "server-overload-20260804",
    noticeAt: "2026-08-03T18:00:00+09:00",
    startAt: "2026-08-04T00:00:00+09:00",
    endAt: "2026-08-05T00:00:00+09:00",
    enabled: true,
  };
  const at = (iso) => new Date(iso);

  it("공지 전에는 공지 시각까지", () => {
    expect(msUntilRecoveryChange(event, at("2026-08-03T17:00:00+09:00"))).toBe(60 * 60 * 1000);
  });

  it("공지 중에는 복구 시작까지", () => {
    expect(msUntilRecoveryChange(event, at("2026-08-03T23:00:00+09:00"))).toBe(60 * 60 * 1000);
  });

  it("복구 중에는 종료까지", () => {
    expect(msUntilRecoveryChange(event, at("2026-08-04T23:00:00+09:00"))).toBe(60 * 60 * 1000);
  });

  it("다 끝났으면 더 기다릴 것이 없다", () => {
    expect(msUntilRecoveryChange(event, at("2026-08-06T00:00:00+09:00"))).toBe(null);
  });

  it("꺼진 이벤트는 기다리지 않는다", () => {
    expect(msUntilRecoveryChange({ ...event, enabled: false }, at("2026-08-03T17:00:00+09:00"))).toBe(null);
  });

  it("경계 정각에는 다음 경계를 본다 — 같은 시각에 반복해 깨지 않도록", () => {
    expect(msUntilRecoveryChange(event, at("2026-08-04T00:00:00+09:00"))).toBe(24 * 60 * 60 * 1000);
  });
});
