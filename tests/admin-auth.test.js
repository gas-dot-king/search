import { afterEach, describe, expect, it } from "vitest";
import {
  adminSessionCookie,
  clearAdminSessionCookie,
  isValidAdminSession,
  verifyAdminPassword,
} from "../lib/adminAuth";

const originalDemoMode = process.env.DEMO_MODE;

afterEach(() => {
  if (originalDemoMode === undefined) delete process.env.DEMO_MODE;
  else process.env.DEMO_MODE = originalDemoMode;
});

describe("관리자 세션 쿠키", () => {
  it("데모 비밀번호로 로그인하고 쿠키를 검증한다", () => {
    process.env.DEMO_MODE = "true";
    expect(verifyAdminPassword("demo")).toBe(true);
    expect(verifyAdminPassword("wrong")).toBe(false);

    const cookie = adminSessionCookie().split(";", 1)[0];
    const req = new Request("http://localhost/api/admin", { headers: { cookie } });
    expect(isValidAdminSession(req)).toBe(true);
  });

  it("만료 토큰과 위조 토큰은 거부한다", () => {
    process.env.DEMO_MODE = "true";
    const cookie = adminSessionCookie().split(";", 1)[0];
    const token = cookie.split("=", 2)[1];
    const [, signature] = token.split(".");
    const expired = `ysrc_admin_session=1.${signature}`;
    const forged = `ysrc_admin_session=${token.slice(0, -1)}x`;

    expect(isValidAdminSession(new Request("http://localhost", { headers: { cookie: expired } }))).toBe(false);
    expect(isValidAdminSession(new Request("http://localhost", { headers: { cookie: forged } }))).toBe(false);
    expect(clearAdminSessionCookie()).toContain("Max-Age=0");
  });
});
