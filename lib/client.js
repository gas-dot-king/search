"use client";

import { readPhotoMetadata } from "./exif";

export const TOKEN_KEY = "ow_token";
const SESSION_LOST_KEY = "ow_session_lost";

export function getToken() {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // 저장소가 차단된 환경에서도 호출한 쪽은 로그인 화면으로 계속 이동한다.
  }
}

/**
 * 계정당 서버 토큰이 하나뿐이라, 다른 기기에서 로그인하면 이 기기는 조용히 401을 받는다.
 * 그대로 입장 화면으로 돌려보내면 이유를 알 수 없으므로 한 번 쓰고 사라지는 표시를 남긴다.
 */
export function markSessionLost() {
  try {
    sessionStorage.setItem(SESSION_LOST_KEY, "1");
  } catch {
    // 안내는 부가 기능이라 저장에 실패해도 로그아웃 흐름 자체는 그대로 진행한다.
  }
}

export function takeSessionLost() {
  try {
    if (sessionStorage.getItem(SESSION_LOST_KEY) === null) return false;
    sessionStorage.removeItem(SESSION_LOST_KEY);
    return true;
  } catch {
    return false;
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

// 빙고판 그리드는 한 칸이 100px 남짓으로 보이는데 1200px 원본을 16장 내려받으면
// 4MB가 넘는다. 같은 사진을 작게 한 장 더 만들어 그리드에서만 쓴다. (약 30KB)
export const THUMB_MAX_SIDE = 320;
const THUMB_QUALITY = 0.7;

function drawScaled(source, sourceWidth, sourceHeight, maxSide) {
  const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("사진 변환을 지원하지 않는 브라우저입니다.");
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

const encodeJpeg = (canvas, quality) => withTimeout(
  new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality)),
  12_000,
  "사진 변환에 시간이 오래 걸립니다."
);

/** 브라우저에서 사진을 리사이즈합니다: 긴 변 1200px, JPEG 품질 80%. */
export async function resizeImage(file, maxSide = 1200, quality = 0.8) {
  if (file.size > 30 * 1024 * 1024) throw new Error("사진 원본은 30MB 이하만 선택할 수 있어요.");
  const decoded = await decodeImage(file);
  let canvas;
  try {
    canvas = drawScaled(decoded.source, decoded.width, decoded.height, maxSide);
  } finally {
    decoded.close();
  }

  let blob = await encodeJpeg(canvas, quality);
  for (let nextQuality = 0.7; blob?.size > 3.8 * 1024 * 1024 && nextQuality >= 0.45; nextQuality -= 0.1) {
    blob = await encodeJpeg(canvas, nextQuality);
  }
  if (!blob) throw new Error("사진 변환에 실패했습니다.");
  if (blob.size > 4 * 1024 * 1024) throw new Error("사진을 4MB 이하로 줄이지 못했어요. 더 작은 사진을 선택해주세요.");
  return blob;
}

/**
 * 업로드용 원본(1200px)과 그리드용 축소본(320px)을 한 번의 디코드로 함께 만든다.
 * 축소본 생성이 실패해도 업로드는 원본만으로 진행한다 — 그리드는 원본으로 그리면 된다.
 */
export async function resizeForUpload(file, maxSide = 1200, quality = 0.8) {
  if (file.size > 30 * 1024 * 1024) throw new Error("사진 원본은 30MB 이하만 선택할 수 있어요.");

  // 촬영 정보는 리사이즈 "전" 원본에만 남아 있다. 캔버스로 다시 그리는 순간 사라지므로
  // 여기서 먼저 뽑아 둔다. 읽기에 실패해도 업로드는 그대로 진행한다.
  let meta = null;
  try {
    meta = readPhotoMetadata(new Uint8Array(await file.arrayBuffer()));
  } catch {
    meta = null;
  }

  const decoded = await decodeImage(file);
  let canvas;
  let thumbCanvas = null;
  try {
    canvas = drawScaled(decoded.source, decoded.width, decoded.height, maxSide);
    try {
      thumbCanvas = drawScaled(decoded.source, decoded.width, decoded.height, THUMB_MAX_SIDE);
    } catch {
      thumbCanvas = null;
    }
  } finally {
    decoded.close();
  }

  let full = await encodeJpeg(canvas, quality);
  for (let nextQuality = 0.7; full?.size > 3.8 * 1024 * 1024 && nextQuality >= 0.45; nextQuality -= 0.1) {
    full = await encodeJpeg(canvas, nextQuality);
  }
  if (!full) throw new Error("사진 변환에 실패했습니다.");
  if (full.size > 4 * 1024 * 1024) throw new Error("사진을 4MB 이하로 줄이지 못했어요. 더 작은 사진을 선택해주세요.");

  let thumb = null;
  if (thumbCanvas) {
    try {
      thumb = await encodeJpeg(thumbCanvas, THUMB_QUALITY);
    } catch {
      thumb = null;
    }
  }
  return { full, thumb, meta };
}

export const PRIVACY_WARNING =
  "⚠️ 사진에 얼굴, 전화번호, 실시간 위치, 차량번호 등 개인정보가 보이지 않는지 꼭 확인하고 올려주세요.";

// 촬영 정보를 기록하기 시작했으므로, 무엇을 남기는지 올리는 화면에서 알린다.
export const METADATA_NOTICE =
  "🔎 인증 검토를 위해 사진의 촬영 시각·위치·기기 정보가 함께 기록되며 운영진만 볼 수 있어요. " +
  "위치를 남기고 싶지 않다면 휴대폰의 '위치 정보 없이 공유'로 사진을 저장해 올려주세요.";

export const CATEGORY_RULE =
  "하루에 각 카테고리에서 1개씩만 인증할 수 있어요. 하루 최대 3칸까지 가능해요.\n이벤트 기간에 찍은 사진만 인증할 수 있어요 — 기간 전에 찍은 사진은 올릴 때 자동으로 걸러집니다.\n빙고 4줄을 먼저 완성한 순서로 선착순 20명을 선정하며, 운영진이 인증 사진을 확인한 뒤 최종 결정합니다.";
