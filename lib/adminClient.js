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

/** 파일이 있는 요청. FormData는 Content-Type을 브라우저가 정해야 해서 따로 둔다. */
export const adminUpload = (path, formData) =>
  adminApi(path, { method: "POST", body: formData });
