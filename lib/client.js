"use client";

export const TOKEN_KEY = "ow_token";

export function getToken() {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
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

function withTimeout(promise, timeoutMs, message) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timer));
}

async function decodeImage(file) {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await withTimeout(
        createImageBitmap(file, { imageOrientation: "from-image" }),
        12_000,
        "사진을 여는 데 시간이 오래 걸립니다."
      );
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close?.(),
      };
    } catch {
      // 일부 iPhone 사진 형식이나 구형 브라우저는 아래 일반 이미지 방식으로 다시 시도합니다.
    }
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.src = objectUrl;
  try {
    await withTimeout(
      image.decode
        ? image.decode()
        : new Promise((resolve, reject) => {
            image.onload = resolve;
            image.onerror = reject;
          }),
      12_000,
      "사진을 여는 데 시간이 오래 걸립니다."
    );
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

/** 브라우저에서 사진을 리사이즈합니다: 긴 변 1200px, JPEG 품질 80%. */
export async function resizeImage(file, maxSide = 1200, quality = 0.8) {
  if (file.size > 30 * 1024 * 1024) throw new Error("사진 원본은 30MB 이하만 선택할 수 있어요.");
  const decoded = await decodeImage(file);
  const scale = Math.min(1, maxSide / Math.max(decoded.width, decoded.height));
  const width = Math.max(1, Math.round(decoded.width * scale));
  const height = Math.max(1, Math.round(decoded.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    decoded.close();
    throw new Error("사진 변환을 지원하지 않는 브라우저입니다.");
  }
  try {
    context.drawImage(decoded.source, 0, 0, width, height);
  } finally {
    decoded.close();
  }

  const encode = (jpegQuality) => withTimeout(
    new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", jpegQuality)),
    12_000,
    "사진 변환에 시간이 오래 걸립니다."
  );
  let blob = await encode(quality);
  for (let nextQuality = 0.7; blob?.size > 3.8 * 1024 * 1024 && nextQuality >= 0.45; nextQuality -= 0.1) {
    blob = await encode(nextQuality);
  }
  if (!blob) throw new Error("사진 변환에 실패했습니다.");
  if (blob.size > 4 * 1024 * 1024) throw new Error("사진을 4MB 이하로 줄이지 못했어요. 더 작은 사진을 선택해주세요.");
  return blob;
}

export const PRIVACY_WARNING =
  "⚠️ 사진에 얼굴, 전화번호, 실시간 위치, 차량번호 등 개인정보가 보이지 않는지 꼭 확인하고 올려주세요.";

export const CATEGORY_RULE =
  "하루에 각 카테고리에서 1개씩만 인증할 수 있어요. 하루 최대 3개까지 가능해요.";
