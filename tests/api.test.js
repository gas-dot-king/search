import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, requireDbSuccess, route } from "../lib/api";

const request = { method: "GET", url: "http://localhost/api/test?id=1" };
const call = (fn) => route(fn)(request);

let errorLog;

beforeEach(() => {
  errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errorLog.mockRestore();
});

describe("route() 오류 응답", () => {
  it("4xx는 사용자에게 보여주려고 지은 문구라 그대로 전달한다", async () => {
    const res = await call(() => {
      throw new ApiError("기록은 숫자 4자리로 입력해주세요.");
    });
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "기록은 숫자 4자리로 입력해주세요." });
    expect(errorLog).not.toHaveBeenCalled();
  });

  it("401 같은 인증 오류도 문구가 유지된다", async () => {
    const res = await call(() => {
      throw new ApiError("로그인이 필요합니다.", 401);
    });
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "로그인이 필요합니다." });
  });

  it("500 ApiError의 DB 메시지는 브라우저로 새어 나가지 않는다", async () => {
    const res = await call(() => {
      throw new ApiError('응모 실패: duplicate key value violates unique constraint "lotto_entries_pkey"', 500);
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    expect(JSON.stringify(body)).not.toContain("lotto_entries_pkey");
  });

  it("예상 못 한 예외도 내부 사정을 감추고 500으로 바꾼다", async () => {
    const res = await call(() => {
      throw new Error("connect ECONNREFUSED db.internal.example:5432");
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    expect(JSON.stringify(body)).not.toContain("db.internal.example");
  });

  it("가려진 원본 오류는 서버 로그에 남아 운영자가 볼 수 있다", async () => {
    const cause = new Error("connect ECONNREFUSED db.internal.example:5432");
    await call(() => {
      throw cause;
    });
    expect(errorLog).toHaveBeenCalledTimes(1);
    const [prefix, logged] = errorLog.mock.calls[0];
    expect(prefix).toContain("/api/test");
    expect(logged).toBe(cause);
  });

  it("requireDbSuccess가 만든 500도 마찬가지로 가려진다", async () => {
    const res = await call(() => {
      requireDbSuccess({ message: 'relation "cells" does not exist' }, "인증 사진 삭제에 실패했습니다");
    });
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
    });
  });

  it("오류가 없으면 requireDbSuccess는 통과시킨다", async () => {
    const res = await call(() => {
      requireDbSuccess(null);
      return { ok: true };
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  it("핸들러가 Response를 직접 반환하면 그대로 내보낸다", async () => {
    const res = await call(() => Response.json({ cached: true }, { headers: { "Cache-Control": "no-store" } }));
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    await expect(res.json()).resolves.toEqual({ cached: true });
  });
});
