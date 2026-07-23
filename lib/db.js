import { createClient } from "@supabase/supabase-js";

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

export async function removePhoto(path) {
  if (!path) return;
  await sb().storage.from(BUCKET).remove([path]);
}

/** 비공개 버킷 사진의 1시간 서명 URL */
export async function signedUrl(path) {
  if (!path) return null;
  const { data } = await sb().storage.from(BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl || null;
}

/** 해당 유저의 빙고판 존재 여부 */
export async function userHasBoard(userId) {
  const { count } = await sb()
    .from("cells")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  return (count || 0) > 0;
}

export async function signedUrls(paths) {
  const valid = paths.filter(Boolean);
  if (valid.length === 0) return {};
  const { data } = await sb().storage.from(BUCKET).createSignedUrls(valid, 3600);
  const map = {};
  for (const row of data || []) {
    if (row.signedUrl) map[row.path] = row.signedUrl;
  }
  return map;
}
