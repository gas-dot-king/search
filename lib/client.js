"use client";

export const TOKEN_KEY = "ow_token";

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export async function api(path, opts = {}) {
  const token = getToken();
  const isForm = opts.body instanceof FormData;
  const res = await fetch(path, {
    ...opts,
    headers: {
      ...(opts.body && !isForm ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(data.error || "요청에 실패했습니다.");
    e.status = res.status;
    throw e;
  }
  return data;
}

/** 브라우저에서 사진 리사이즈: 긴 변 1080px, JPEG 80% */
export async function resizeImage(file, maxSide = 1080, quality = 0.8) {
  const bitmap = await createImageBitmap(file); // EXIF 회전 자동 반영
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("사진 변환에 실패했습니다.");
  return blob;
}

export const PRIVACY_WARNING =
  "⚠️ 사진에 얼굴, 전화번호, 실시간 위치, 차량번호 등 개인정보가 보이지 않는지 꼭 확인하고 올려주세요.";

export const CATEGORY_RULE =
  "하루 러닝(운동) 한 번으로는 각 카테고리에서 1칸씩만 채울 수 있어요. 헷갈리면 '인증 예시 보기'를 눌러보세요!";
