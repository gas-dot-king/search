import { sb, uploadPhoto, removePhoto } from "@/lib/db";
import { route, requireUser, requireUploadPeriod, readPhoto, readJson, ApiError } from "@/lib/api";

async function findCell(userId, position) {
  const { data: cell } = await sb()
    .from("cells")
    .select("id, photo_path")
    .eq("user_id", userId)
    .eq("position", Number(position))
    .single();
  return cell;
}

/** 빙고 칸 사진 업로드/교체 */
export const POST = route(async (req) => {
  const user = await requireUser(req);
  await requireUploadPeriod();

  const form = await req.formData().catch(() => null);
  const position = Number(form?.get("position"));
  if (!Number.isInteger(position) || position < 0 || position > 15) throw new ApiError("잘못된 칸입니다.");
  const buffer = await readPhoto(form);

  const cell = await findCell(user.id, position);
  if (!cell) throw new ApiError("빙고판이 없습니다. 먼저 빙고를 뽑아주세요.");

  const path = `bingo/${user.id}/${position}-${Date.now()}.jpg`;
  await uploadPhoto(path, buffer);

  const oldPath = cell.photo_path;
  const { error } = await sb()
    .from("cells")
    .update({ photo_path: path, uploaded_at: new Date().toISOString() })
    .eq("id", cell.id);
  if (error) {
    await removePhoto(path);
    throw new ApiError("저장 실패: " + error.message, 500);
  }
  if (oldPath && oldPath !== path) await removePhoto(oldPath);

  return { ok: true };
});

/** 빙고 칸 사진 삭제 */
export const DELETE = route(async (req) => {
  const user = await requireUser(req);
  await requireUploadPeriod();

  const { position } = await readJson(req);
  const cell = await findCell(user.id, position);
  if (!cell?.photo_path) throw new ApiError("삭제할 사진이 없습니다.");

  await sb().from("cells").update({ photo_path: null, uploaded_at: null }).eq("id", cell.id);
  await removePhoto(cell.photo_path);
  return { ok: true };
});
