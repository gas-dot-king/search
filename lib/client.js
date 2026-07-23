"use client";

export const TOKEN_KEY = "ow_token";

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export class RequestError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "RequestError";
    this.status = status;
  }
}

function requestHeaders(opts, headers) {
  const isForm = opts.body instanceof FormData;
  return {
    ...(opts.body && !isForm ? { "Content-Type": "application/json" } : {}),
    ...headers,
    ...(opts.headers || {}),
  };
}

/** JSON 응답과 API 오류를 한 형태로 처리합니다. */
export async function requestJson(path, opts = {}, headers = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: requestHeaders(opts, headers),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new RequestError(data.error || "요청 처리에 실패했습니다.", res.status);
  return data;
}

export function api(path, opts = {}) {
  const token = getToken();
  return requestJson(path, opts, token ? { Authorization: `Bearer ${token}` } : {});
}

/** 브라우저에서 사진을 리사이즈합니다: 긴 변 1200px, JPEG 품질 80%. */
export async function resizeImage(file, maxSide = 1200, quality = 0.8) {
  const bitmap = await createImageBitmap(file); // EXIF 회전 자동 반영
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("사진 변환에 실패했습니다.");
  return blob;
}

export const PRIVACY_WARNING =
  "⚠️ 사진에 얼굴, 전화번호, 실시간 위치, 차량번호 등 개인정보가 보이지 않는지 꼭 확인하고 올려주세요.";

export const CATEGORY_RULE =
  "하루 러닝(운동) 한 번으로는 각 카테고리에서 1칸씩만 채울 수 있어요. 헷갈리면 '인증 예시 보기'를 눌러보세요!";
