"use client";

const PW_KEY = "ow_admin_pw";

export const adminPw = {
  get: () => sessionStorage.getItem(PW_KEY) || "",
  set: (v) => sessionStorage.setItem(PW_KEY, v),
  clear: () => sessionStorage.removeItem(PW_KEY),
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
