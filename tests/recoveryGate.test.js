import { describe, expect, it } from "vitest";
import { isRecoveryGatedPath as isGatedPath } from "../lib/recovery";

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
