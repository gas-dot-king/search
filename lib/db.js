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

/** 여러 사진을 스토리지 API 1회 호출로 한꺼번에 삭제한다 */
export async function removePhotos(paths) {
  const valid = [...new Set((paths || []).filter(Boolean))];
  if (valid.length === 0) return;
  for (const path of valid) signedUrlCache.delete(path);
  const { error } = await sb().storage.from(BUCKET).remove(valid);
  if (error) throw new Error(`사진 삭제에 실패했습니다: ${error.message}`);
}

// Storage 정리는 회원 응답 시간에 들어갈 이유가 없다. 큐 기록(유실 방지)만 요청 안에서
// 하고, 실제 삭제는 응답을 보낸 뒤로 미룬다. next/server를 동적 import 하는 이유:
// 정적 import면 lib/api.js를 거쳐 db.js를 물고 들어가는 vitest가 Next 런타임을 요구하게 된다.
async function runAfterResponse(task) {
  const safeTask = async () => {
    try {
      await task();
    } catch (error) {
      console.error("[storage cleanup] background run failed", error);
    }
  };
  try {
    const { after } = await import("next/server");
    after(safeTask);
  } catch {
    // Next 요청 컨텍스트 밖(스크립트·테스트)에서는 즉시 실행으로 대체한다.
    safeTask();
  }
}

/** 밀린 정리 작업을 응답 이후에 시도한다. 큐에 남아 있으므로 실패해도 유실되지 않는다. */
export function deferPhotoCleanup(paths = null) {
  void runAfterResponse(() => processPhotoCleanup(paths));
}

/** Queue an obsolete path before trying Storage. A later mutation retries it. */
export async function schedulePhotoCleanup(paths) {
  const valid = [...new Set((paths || []).filter(Boolean))];
  if (!valid.length) return { pending: false };
  const { error: queueError } = await sb()
    .from("storage_cleanup_tasks")
    .upsert(valid.map((path) => ({ path, last_error: null })), { onConflict: "path" });
  if (queueError) throw new Error(`사진 정리 작업을 기록하지 못했습니다: ${queueError.message}`);
  deferPhotoCleanup(valid);
  return { pending: true };
}

/** Best-effort execution with a persistent retry record; never hides errors. */
export async function processPhotoCleanup(paths = null) {
  let targets = paths;
  if (!targets) {
    const { data, error } = await sb()
      .from("storage_cleanup_tasks")
      .select("path")
      .order("created_at")
      .limit(40);
    if (error) throw new Error(`사진 정리 작업을 읽지 못했습니다: ${error.message}`);
    targets = (data || []).map((row) => row.path);
  }
  const valid = [...new Set((targets || []).filter(Boolean))];
  if (!valid.length) return { pending: false };

  try {
    await removePhotos(valid);
    const { error } = await sb().from("storage_cleanup_tasks").delete().in("path", valid);
    if (error) throw new Error(`사진 정리 완료를 기록하지 못했습니다: ${error.message}`);
    return { pending: false };
  } catch (error) {
    const message = String(error?.message || error).slice(0, 500);
    const { error: recordError } = await sb()
      .from("storage_cleanup_tasks")
      .update({ last_error: message, attempts: 1 })
      .in("path", valid);
    if (recordError) throw new Error(`사진 삭제와 재시도 기록에 모두 실패했습니다: ${recordError.message}`);
    console.error("[storage cleanup] queued for retry", { paths: valid, error });
    return { pending: true };
  }
}

export async function claimBingoPhoto(userId, position, path) {
  const { data, error } = await sb()
    .rpc("claim_bingo_photo", {
      p_user_id: userId,
      p_position: position,
      p_photo_path: path,
    })
    .single();
  return { oldPath: data?.old_path || null, error };
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
  const { data, error } = await sb()
    .from("cells")
    .select("id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`빙고판을 확인하지 못했습니다: ${error.message}`);
  return Boolean(data);
}

export async function userBoardStatus(userId) {
  if (isDemoMode()) return { hasBoard: demoHasBoard(userId), redrawAvailable: false };
  const [{ data: user, error: userError }, { data: cells, error: cellsError }] = await Promise.all([
    sb().from("users").select("redraw_used").eq("id", userId).single(),
    sb().from("cells").select("photo_path").eq("user_id", userId),
  ]);
  if (userError || cellsError) throw new Error(`Board status failed: ${(userError || cellsError).message}`);
  const rows = cells || [];
  const hasBoard = rows.length > 0;
  return { hasBoard, redrawAvailable: hasBoard && !user?.redraw_used && !rows.some((cell) => cell.photo_path) };
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

  const { data, error } = await sb().storage.from(BUCKET).createSignedUrls(missing, SIGNED_URL_TTL_SECONDS);
  if (error) throw new Error(`사진 주소를 만들지 못했습니다: ${error.message}`);
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
