import crypto from "node:crypto";
import { deferPhotoCleanup, schedulePhotoCleanup, sb, signedUrls, thumbPathFor, uploadPhoto } from "@/lib/db";
import { route, requireAdmin, readPhoto, readOptionalPhoto, ApiError, requireDbSuccess } from "@/lib/api";
import { sanitizePhotoMetadata } from "@/lib/exif";
import { todayInSeoul } from "@/lib/bingo";
import { invalidateBingoHallCache } from "@/lib/progress";
import { demoAdminPutCellPhoto, isDemoMode } from "@/lib/demo";

/**
 * 운영진이 회원 칸에 인증 사진을 직접 넣는다.
 *
 * 실수로 지운 사진을 되돌리거나, 회원이 올리지 못하는 사정이 있을 때 쓴다.
 * 회원 업로드와 달리 하루 3칸·카테고리당 1칸 제한을 적용하지 않는다 —
 * 되돌리는 작업까지 제한에 걸리면 고칠 방법이 없어진다.
 * 대신 운영진 비밀번호가 있어야 하고, 어느 칸에 넣었는지 화면에 바로 보인다.
 */
export const POST = route(async (req) => {
  await requireAdmin(req);

  const form = await req.formData().catch(() => null);
  const userId = String(form?.get("userId") || "").trim();
  const position = Number(form?.get("position"));
  if (!userId) throw new ApiError("회원을 찾을 수 없습니다.");
  if (!Number.isInteger(position) || position < 0 || position > 15) throw new ApiError("잘못된 칸입니다.");

  if (isDemoMode()) {
    if (!form?.get("file")) throw new ApiError("사진 파일이 없습니다.");
    const result = demoAdminPutCellPhoto(userId, position);
    if (result.error) throw new ApiError(result.error, result.status || 400);
    return result;
  }

  const buffer = await readPhoto(form);
  const thumbBuffer = await readOptionalPhoto(form, "thumb");
  const photoMeta = sanitizePhotoMetadata(
    (() => {
      try {
        return JSON.parse(String(form?.get("meta") || "null"));
      } catch {
        return null;
      }
    })()
  );

  const { data: cell, error: cellError } = await sb()
    .from("cells")
    .select("id, photo_path")
    .eq("user_id", userId)
    .eq("position", position)
    .maybeSingle();
  requireDbSuccess(cellError, "빙고 칸을 확인하지 못했습니다");
  if (!cell) throw new ApiError("이 회원에게는 아직 빙고판이 없습니다.", 404);

  const path = `bingo/${userId}/${position}-${crypto.randomUUID()}.jpg`;
  const thumbPath = thumbPathFor(path);
  const [, thumbStored] = await Promise.all([
    uploadPhoto(path, buffer),
    thumbBuffer
      ? uploadPhoto(thumbPath, thumbBuffer).then(() => true).catch((error) => {
          console.error("[admin photo] thumbnail failed", error);
          return false;
        })
      : Promise.resolve(false),
  ]);

  const now = new Date();
  const { error } = await sb()
    .from("cells")
    .update({
      photo_path: path,
      uploaded_at: now.toISOString(),
      uploaded_date: todayInSeoul(now),
      photo_meta: photoMeta,
    })
    .eq("id", cell.id);
  if (error) {
    // 새 파일은 아직 아무 데서도 참조하지 않으므로 지워도 안전하다.
    await schedulePhotoCleanup(thumbStored ? [path, thumbPath] : [path]);
    throw new ApiError("사진을 저장하지 못했습니다: " + error.message, 500);
  }

  // 바뀐 인증이 명예의 전당 집계에도 바로 반영되게 한다.
  invalidateBingoHallCache();

  const oldPath = cell.photo_path;
  if (oldPath && oldPath !== path) {
    await schedulePhotoCleanup([oldPath, thumbPathFor(oldPath)]);
  } else {
    deferPhotoCleanup();
  }

  const urlMap = await signedUrls(thumbStored ? [path, thumbPath] : [path], { retryMissing: false });
  return { ok: true, photoUrl: urlMap[path] || null, replaced: Boolean(oldPath) };
});
