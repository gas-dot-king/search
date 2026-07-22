"use client";

// 비밀번호는 메모리에만 유지 → 새로고침/재방문 시 항상 다시 입력
let pw = "";

export const adminPw = {
  get: () => pw,
  set: (v) => { pw = v; },
  clear: () => { pw = ""; },
};

export async function adminApi(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: {
      "x-admin-password": adminPw.get(),
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(data.error || "요청 실패");
    e.status = res.status;
    throw e;
  }
  return data;
}

export const adminPost = (body) =>
  adminApi("/api/admin", { method: "POST", body: JSON.stringify(body) });
