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
