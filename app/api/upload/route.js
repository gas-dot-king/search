import { sb, uploadPhoto, removePhoto } from "@/lib/db";
import { getUser, json, err } from "@/lib/auth";
import { getSettings, inUploadPeriod } from "@/lib/settings";

const MAX_BYTES = 5 * 1024 * 1024; // 리사이즈된 JPEG 기준 넉넉한 상한

/** 빙고 칸 사진 업로드/교체 */
export async function POST(req) {
  const user = await getUser(req);
  if (!user) return err("로그인이 필요합니다.", 401);

  const settings = await getSettings();
  if (!inUploadPeriod(settings)) return err("지금은 업로드 기간이 아닙니다.");

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const position = Number(form?.get("position"));
  if (!file || typeof file.arrayBuffer !== "function") return err("사진 파일이 없습니다.");
  if (!Number.isInteger(position) || position < 0 || position > 15) return err("잘못된 칸입니다.");
  if (file.size > MAX_BYTES) return err("사진이 너무 큽니다. (5MB 이하)");

  const { data: cell } = await sb()
    .from("cells")
    .select("id, photo_path")
    .eq("user_id", user.id)
    .eq("position", position)
    .single();
  if (!cell) return err("빙고판이 없습니다. 먼저 빙고를 뽑아주세요.");

  const path = `bingo/${user.id}/${position}-${Date.now()}.jpg`;
  await uploadPhoto(path, Buffer.from(await file.arrayBuffer()));

  const oldPath = cell.photo_path;
  const { error } = await sb()
    .from("cells")
    .update({ photo_path: path, uploaded_at: new Date().toISOString() })
    .eq("id", cell.id);
  if (error) {
    await removePhoto(path);
    return err("저장 실패: " + error.message, 500);
  }
  if (oldPath && oldPath !== path) await removePhoto(oldPath);

  return json({ ok: true });
}

/** 빙고 칸 사진 삭제 */
export async function DELETE(req) {
  const user = await getUser(req);
  if (!user) return err("로그인이 필요합니다.", 401);

  const settings = await getSettings();
  if (!inUploadPeriod(settings)) return err("지금은 업로드 기간이 아닙니다.");

  const { position } = await req.json().catch(() => ({}));
  const { data: cell } = await sb()
    .from("cells")
    .select("id, photo_path")
    .eq("user_id", user.id)
    .eq("position", Number(position))
    .single();
  if (!cell?.photo_path) return err("삭제할 사진이 없습니다.");

  await sb().from("cells").update({ photo_path: null, uploaded_at: null }).eq("id", cell.id);
  await removePhoto(cell.photo_path);
  return json({ ok: true });
}
