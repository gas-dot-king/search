"use client";

import { requestJson } from "./client";

// 관리자 비밀번호는 브라우저 메모리에만 보관합니다.
let password = "";

export const adminPw = {
  get: () => password,
  set: (value) => {
    password = value;
  },
  clear: () => {
    password = "";
  },
};

export function adminApi(path, opts = {}) {
  return requestJson(path, opts, { "x-admin-password": adminPw.get() });
}

export const adminPost = (body) =>
  adminApi("/api/admin", { method: "POST", body: JSON.stringify(body) });
