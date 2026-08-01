import crypto from "node:crypto";
import {
  claimBingoPhoto,
  deferPhotoCleanup,
  schedulePhotoCleanup,
  sb,
  signedUrls,
  thumbPathFor,
  uploadPhoto,
} from "@/lib/db";
import {
  route,
  requireUserInUploadPeriod,
  readPhoto,
  readOptionalPhoto,
  readJson,
  ApiError,
  requireDbSuccess,
} from "@/lib/api";
import { demoRemoveUpload, demoUpload, isDemoMode } from "@/lib/demo";
import { sanitizePhotoMetadata } from "@/lib/exif";
import { dailyLimitMessage, todayInSeoul } from "@/lib/bingo";

/** 오늘 이미 인증한 칸들 — 제한 안내에서 "무엇이 막고 있는지" 짚어 주는 데 쓴다 */
async function todayCells(userId) {
  const { data } = await sb()
    .from("cells")
    .select("bingo_items ( content, category )")
    .eq("user_id", userId)
    .eq("uploaded_date", todayInSeoul())
    .not("photo_path", "is", null);
  return (data || []).map((row) => ({
    content: row.bingo_items?.content || "",
    category: row.bingo_items?.category || 0,
  }));
}

async function bingoClaimError(error, userId, category) {
  const code = String(error?.message || "");
  if (code.includes("BINGO_CELL_NOT_FOUND")) return new ApiError("빙고판이 없습니다. 먼저 빙고를 뽑아주세요.", 404);
  if (code.includes("BINGO_DAILY_LIMIT") || code.includes("BINGO_CATEGORY_DAILY_LIMIT")) {
    // 목록 조회가 실패해도 안내는 나가야 하므로 빈 배열로 물러선다
    const cells = await todayCells(userId).catch(() => []);
    const blockingCategory = code.includes("BINGO_CATEGORY_DAILY_LIMIT") ? category : 0;
    return new ApiError(dailyLimitMessage(cells, blockingCategory), 403);
  }
  return new ApiError("빙고 인증을 저장하지 못했습니다.", 500);
}

async function findCell(userId, position) {
  const { data: cell, error } = await sb()
    .from("cells")
    .select("id, photo_path, bingo_items ( category )")
    .eq("user_id", userId)
    .eq("position", Number(position))
    .maybeSingle();
  requireDbSuccess(error, "빙고 칸을 확인하지 못했습니다");
  return cell;
}

/** Bingo photo upload/replacement. Daily rules are enforced by a DB transaction. */
export const POST = route(async (req) => {
  const user = await requireUserInUploadPeriod(req);
  if (!isDemoMode()) deferPhotoCleanup();
  const form = await req.formData().catch(() => null);
  const position = Number(form?.get("position"));
  if (!Number.isInteger(position) || position < 0 || position > 15) throw new ApiError("잘못된 칸입니다.");

  if (isDemoMode()) {
    if (!form?.get("file")) throw new ApiError("사진 파일이 없습니다.");
    const result = demoUpload(user.id, position);
    if (result.error) throw new ApiError(result.error, 403);
    return result;
  }

  const buffer = await readPhoto(form);
  // 그리드용 축소본. 브라우저가 만들지 못했으면 없는 대로 두고 원본을 쓴다.
  const thumbBuffer = await readOptionalPhoto(form, "thumb");
  const path = `bingo/${user.id}/${position}-${crypto.randomUUID()}.jpg`;
  const thumbPath = thumbPathFor(path);

  // 원본과 축소본을 동시에 올린다. 축소본이 실패해도 인증 자체는 살린다.
  const [, thumbStored] = await Promise.all([
    uploadPhoto(path, buffer),
    thumbBuffer
      ? uploadPhoto(thumbPath, thumbBuffer).then(() => true).catch((uploadError) => {
          console.error("[upload] thumbnail failed", uploadError);
          return false;
        })
      : Promise.resolve(false),
  ]);

  const photoMeta = sanitizePhotoMetadata(
    (() => {
      try {
        return JSON.parse(String(form?.get("meta") || "null"));
      } catch {
        return null;
      }
    })()
  );

  const { oldPath, error } = await claimBingoPhoto(user.id, position, path);
  if (error) {
    // The new file has no DB reference, so retrying its deletion is always safe.
    await schedulePhotoCleanup(thumbStored ? [path, thumbPath] : [path]);
    const cell = await findCell(user.id, position).catch(() => null);
    throw await bingoClaimError(error, user.id, cell?.bingo_items?.category || 0);
  }

  // 촬영 정보는 인증 검토용 부가 기록이라, 저장에 실패해도 인증 자체는 살린다.
  // (photo_meta 컬럼 마이그레이션 적용 전에 배포돼도 업로드가 멈추지 않는다)
  const { error: metaError } = await sb()
    .from("cells")
    .update({ photo_meta: photoMeta })
    .eq("user_id", user.id)
    .eq("position", position)
    .eq("photo_path", path);
  if (metaError) console.error("[upload] photo metadata not stored", metaError);

  // 화면이 이 응답만으로 칸을 갱신할 수 있게 주소를 함께 준다.
  // 빙고판 전체를 다시 불러오면 나머지 15칸의 서명 주소까지 새로 발급돼
  // 브라우저가 이미 받아 둔 사진을 전부 다시 내려받는다.
  const urlMap = await signedUrls(thumbStored ? [path, thumbPath] : [path], { retryMissing: false });

  const cleanup = oldPath && oldPath !== path
    ? await schedulePhotoCleanup([oldPath, thumbPathFor(oldPath)])
    : { pending: false };
  return {
    ok: true,
    cleanupPending: cleanup.pending,
    photoUrl: urlMap[path] || null,
    thumbUrl: (thumbStored && urlMap[thumbPath]) || null,
  };
});

/** Remove a bingo photo. DB state changes first; Storage failures stay queued. */
export const DELETE = route(async (req) => {
  const user = await requireUserInUploadPeriod(req);
  if (!isDemoMode()) deferPhotoCleanup();
  const { position } = await readJson(req);
  if (!Number.isInteger(Number(position)) || Number(position) < 0 || Number(position) > 15) {
    throw new ApiError("잘못된 칸입니다.");
  }

  if (isDemoMode()) {
    const result = demoRemoveUpload(user.id, Number(position));
    if (result.error) throw new ApiError(result.error);
    return result;
  }

  const cell = await findCell(user.id, Number(position));
  if (!cell?.photo_path) throw new ApiError("삭제할 사진이 없습니다.", 404);
  const { error } = await sb()
    .from("cells")
    .update({ photo_path: null, uploaded_at: null, uploaded_date: null, photo_meta: null })
    .eq("id", cell.id)
    .eq("photo_path", cell.photo_path);
  requireDbSuccess(error, "인증 사진 삭제에 실패했습니다");
  const cleanup = await schedulePhotoCleanup([cell.photo_path, thumbPathFor(cell.photo_path)]);
  return { ok: true, cleanupPending: cleanup.pending };
});
