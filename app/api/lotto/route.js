import { sb, uploadPhotoAndPersist, removePhoto, signedUrls } from "@/lib/db";
import { route, requireUser, requireUploadPeriod, readPhoto, readJson, ApiError, requireDbSuccess } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { matchCount, computeWinners } from "@/lib/lotto";

/** 내 응모 목록 + 추첨 진행 상황(자리별 공개) + 완료 시 전체 결과 */
export const GET = route(async (req) => {
  const user = await requireUser(req);
  const url = new URL(req.url);
  const includePhotos = url.searchParams.get("photos") === "1";
  const settingsPromise = getSettings();
  const settings = await settingsPromise;
  const winning = settings.winning_numbers || ""; // 0~4자리 (진행 중 부분 공개)
  const complete = winning.length === 4;
  const maxEntries = Number(settings.max_lotto_entries || 1);

  if (url.searchParams.get("summary") === "1") {
    const { count, error } = await sb()
      .from("lotto_entries")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    if (error) throw new ApiError("응모 현황을 불러오지 못했습니다.", 500);
    return {
      entryCount: count || 0,
      maxEntries,
      uploadEnd: settings.upload_end,
      winningNumbers: winning,
    };
  }

  const minePromise = sb()
    .from("lotto_entries")
    .select("id, digits, photo_path, created_at")
    .eq("user_id", user.id)
    .order("created_at");
  const { data: mine } = await minePromise;
  const urlMapPromise = includePhotos
    ? signedUrls((mine || []).map((e) => e.photo_path))
    : Promise.resolve({});

  let winners = null;
  let urlMap;
  if (complete) {
    const [{ data: all }, urls] = await Promise.all([
      sb().from("lotto_entries").select("digits, users ( nickname )"),
      urlMapPromise,
    ]);
    winners = computeWinners(all, winning);
    urlMap = urls;
  } else {
    urlMap = await urlMapPromise;
  }

  return {
    entries: (mine || []).map((e) => ({
      id: e.id,
      digits: e.digits,
      hasPhoto: Boolean(e.photo_path),
      photoUrl: includePhotos ? urlMap[e.photo_path] || null : null,
      matches: complete ? matchCount(e.digits, winning) : null,
    })),
    maxEntries,
    uploadEnd: settings.upload_end,
    winningNumbers: winning,
    winners,
    photosLoaded: includePhotos,
  };
});

/** 로또 응모: digits("0524") + 사진 (기간 내라면 추첨 진행과 무관하게 가능) */
export const POST = route(async (req) => {
  const user = await requireUser(req);
  const settings = await requireUploadPeriod();

  const form = await req.formData().catch(() => null);
  const digits = String(form?.get("digits") || "");
  if (!/^\d{4}$/.test(digits)) throw new ApiError("기록은 숫자 4자리(xx.xx)로 입력해주세요.");
  const buffer = await readPhoto(form);

  const { count } = await sb()
    .from("lotto_entries")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  const max = Number(settings.max_lotto_entries || 1);
  if ((count || 0) >= max) throw new ApiError(`응모는 최대 ${max}장까지 가능합니다.`);

  const path = `lotto/${user.id}/${Date.now()}.jpg`;
  const { error } = await uploadPhotoAndPersist(path, buffer, () =>
    sb().from("lotto_entries").insert({ user_id: user.id, digits, photo_path: path })
  );
  if (error) {
    throw new ApiError("응모 실패: " + error.message, 500);
  }
  return { ok: true };
});

/** 내 응모 취소 (기간 내) */
export const DELETE = route(async (req) => {
  const user = await requireUser(req);
  await requireUploadPeriod();

  const { id } = await readJson(req);
  const { data: entry } = await sb()
    .from("lotto_entries")
    .select("id, photo_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!entry) throw new ApiError("응모를 찾을 수 없습니다.", 404);

  const { error } = await sb().from("lotto_entries").delete().eq("id", entry.id);
  requireDbSuccess(error, "응모 취소에 실패했습니다");
  await removePhoto(entry.photo_path);
  return { ok: true };
});
