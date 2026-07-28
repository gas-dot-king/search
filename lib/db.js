import { createClient } from "@supabase/supabase-js";
import { demoHasBoard, isDemoMode } from "./demo";

let client;

/** 서버 전용 Supabase 클라이언트 (service role) — 절대 클라이언트로 노출 금지 */
export function sb() {
  if (!client) {
    client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
  }
  return client;
}

const BUCKET = "photos";
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const SIGNED_URL_CACHE_TTL_MS = 55 * 60 * 1000;
const MAX_SIGNED_URL_CACHE_ENTRIES = 500;
const signedUrlCache = new Map();

function getCachedSignedUrl(path) {
  const cached = signedUrlCache.get(path);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    signedUrlCache.delete(path);
    return null;
  }
  return cached.url;
}

function cacheSignedUrl(path, url) {
  signedUrlCache.set(path, { url, expiresAt: Date.now() + SIGNED_URL_CACHE_TTL_MS });
  while (signedUrlCache.size > MAX_SIGNED_URL_CACHE_ENTRIES) {
    signedUrlCache.delete(signedUrlCache.keys().next().value);
  }
}

export async function uploadPhoto(path, buffer) {
  const { error } = await sb().storage.from(BUCKET).upload(path, buffer, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (error) throw new Error(`사진 업로드 실패: ${error.message}`);
  return path;
}

/**
 * 파일 업로드와 DB 저장을 하나의 작업처럼 수행합니다.
 * DB 저장이 실패하면 방금 업로드한 파일을 정리해 고아 파일이 남지 않게 합니다.
 */
export async function uploadPhotoAndPersist(path, buffer, persist) {
  await uploadPhoto(path, buffer);
  try {
    const result = await persist();
    if (!result?.error) return result;
    await removePhoto(path);
    return result;
  } catch (error) {
    await removePhoto(path);
    throw error;
  }
}

export function removePhoto(path) {
  return removePhotos([path]);
}

/** 여러 사진을 스토리지 API 1회 호출로 한꺼번에 삭제한다 */
export async function removePhotos(paths) {
  const valid = [...new Set((paths || []).filter(Boolean))];
  if (valid.length === 0) return;
  for (const path of valid) signedUrlCache.delete(path);
  await sb().storage.from(BUCKET).remove(valid);
}

/** 비공개 버킷 사진의 1시간 서명 URL */
export async function signedUrl(path) {
  if (!path) return null;
  const cached = getCachedSignedUrl(path);
  if (cached) return cached;
  const { data } = await sb().storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (!data?.signedUrl) return null;
  cacheSignedUrl(path, data.signedUrl);
  return data.signedUrl;
}

/** 해당 유저의 빙고판 존재 여부 */
export async function userHasBoard(userId) {
  if (isDemoMode()) return demoHasBoard(userId);
  const { data } = await sb()
    .from("cells")
    .select("id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

export async function signedUrls(paths) {
  const valid = [...new Set(paths.filter(Boolean))];
  if (valid.length === 0) return {};
  const map = {};
  const missing = [];
  for (const path of valid) {
    const cached = getCachedSignedUrl(path);
    if (cached) map[path] = cached;
    else missing.push(path);
  }

  if (missing.length === 0) return map;

  const { data } = await sb().storage.from(BUCKET).createSignedUrls(missing, SIGNED_URL_TTL_SECONDS);
  for (const row of data || []) {
    if (row.signedUrl) {
      cacheSignedUrl(row.path, row.signedUrl);
      map[row.path] = row.signedUrl;
    }
  }

  // 일괄 서명에서 일부 사진이 누락되는 경우 개별 서명으로 한 번 더 복구합니다.
  // 업로드는 끝났는데 화면에 사진 로딩 표시만 계속 남는 상황을 줄여 줍니다.
  const unresolved = missing.filter((path) => !map[path]);
  const fallbackUrls = await Promise.all(
    unresolved.map(async (path) => {
      try {
        return [path, await signedUrl(path)];
      } catch {
        return [path, null];
      }
    })
  );
  for (const [path, url] of fallbackUrls) {
    if (url) map[path] = url;
  }
  return map;
}
