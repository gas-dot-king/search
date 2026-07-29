import crypto from "node:crypto";
import { claimBingoPhoto, processPhotoCleanup, schedulePhotoCleanup, sb, uploadPhoto } from "@/lib/db";
import { route, requireUser, requireUploadPeriod, readPhoto, readJson, ApiError, requireDbSuccess } from "@/lib/api";
import { demoRemoveUpload, demoUpload, isDemoMode } from "@/lib/demo";

function bingoClaimError(error) {
  const code = String(error?.message || "");
  if (code.includes("BINGO_DAILY_LIMIT")) return new ApiError("하루에는 빙고를 최대 3칸까지만 인증할 수 있어요.", 403);
  if (code.includes("BINGO_CATEGORY_DAILY_LIMIT")) return new ApiError("하루에는 같은 카테고리를 1칸만 인증할 수 있어요.", 403);
  if (code.includes("BINGO_CELL_NOT_FOUND")) return new ApiError("빙고판이 없습니다. 먼저 빙고를 뽑아주세요.", 404);
  return new ApiError("빙고 인증을 저장하지 못했습니다.", 500);
}

async function findCell(userId, position) {
  const { data: cell, error } = await sb()
    .from("cells")
    .select("id, photo_path")
    .eq("user_id", userId)
    .eq("position", Number(position))
    .maybeSingle();
  requireDbSuccess(error, "빙고 칸을 확인하지 못했습니다");
  return cell;
}

/** Bingo photo upload/replacement. Daily rules are enforced by a DB transaction. */
export const POST = route(async (req) => {
  const user = await requireUser(req);
  await requireUploadPeriod();
  if (!isDemoMode()) await processPhotoCleanup();
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
  const path = `bingo/${user.id}/${position}-${crypto.randomUUID()}.jpg`;
  await uploadPhoto(path, buffer);

  const { oldPath, error } = await claimBingoPhoto(user.id, position, path);
  if (error) {
    // The new file has no DB reference, so retrying its deletion is always safe.
    await schedulePhotoCleanup([path]);
    throw bingoClaimError(error);
  }

  const cleanup = oldPath && oldPath !== path ? await schedulePhotoCleanup([oldPath]) : { pending: false };
  return { ok: true, cleanupPending: cleanup.pending };
});

/** Remove a bingo photo. DB state changes first; Storage failures stay queued. */
export const DELETE = route(async (req) => {
  const user = await requireUser(req);
  await requireUploadPeriod();
  if (!isDemoMode()) await processPhotoCleanup();
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
    .update({ photo_path: null, uploaded_at: null, uploaded_date: null })
    .eq("id", cell.id)
    .eq("photo_path", cell.photo_path);
  requireDbSuccess(error, "인증 사진 삭제에 실패했습니다");
  const cleanup = await schedulePhotoCleanup([cell.photo_path]);
  return { ok: true, cleanupPending: cleanup.pending };
});
