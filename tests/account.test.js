import { describe, expect, it } from "vitest";
import { demoAuth, demoChangePin, demoGetUser } from "../lib/demo";

describe("데모 계정 PIN 변경", () => {
  it("현재 PIN을 확인하고 PIN과 로그인 토큰을 함께 교체한다", () => {
    const created = demoAuth("PIN변경테스트", "1234");
    const previousToken = created.user.token;

    expect(demoChangePin(created.user.id, "9999", "5678")).toMatchObject({
      error: "현재 PIN이 맞지 않습니다.",
      status: 401,
    });

    const changed = demoChangePin(created.user.id, "1234", "5678");
    expect(changed.token).toBeTruthy();
    expect(changed.token).not.toBe(previousToken);
    expect(demoGetUser(previousToken)).toBeNull();
    expect(demoGetUser(changed.token)?.id).toBe(created.user.id);

    expect(demoAuth("PIN변경테스트", "1234")).toMatchObject({ status: 401 });
    expect(demoAuth("PIN변경테스트", "5678").user.id).toBe(created.user.id);
  });
});
