"use client";

import { requestJson } from "./client";

export function adminApi(path, opts = {}) {
  return requestJson(path, opts);
}

export function adminLogin(password) {
  return requestJson("/api/admin", {
    method: "POST",
    body: JSON.stringify({ action: "login", password }),
  });
}

export function adminLogout() {
  return requestJson("/api/admin", {
    method: "POST",
    body: JSON.stringify({ action: "logout" }),
  });
}

export const adminPost = (body) =>
  adminApi("/api/admin", { method: "POST", body: JSON.stringify(body) });

/** 파일이 있는 요청. FormData는 Content-Type을 브라우저가 정해야 해서 따로 둔다. */
export const adminUpload = (path, formData) =>
  adminApi(path, { method: "POST", body: formData });
