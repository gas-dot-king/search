import crypto from "node:crypto";
import { sb, uploadPhoto, deferPhotoCleanup, schedulePhotoCleanup, signedUrls } from "@/lib/db";
import { route, requireUser, requireUserInUploadPeriod, readPhoto, readJson, ApiError, requireDbSuccess } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import {
  matchCount,
  computeWinners,
  currentLottoRound,
  parseLottoRounds,
  LOTTO_DRAW_DIGITS,
  LOTTO_ENTRY_LIMIT,
} from "@/lib/lotto";
import { demoLotto, demoLottoAdd, demoLottoRemove, demoLottoSummary, isDemoMode } from "@/lib/demo";
import { sanitizePhotoMetadata } from "@/lib/exif";
import { takenBeforeEvent } from "@/lib/photoReview";
import { formatKoreanDateTime } from "@/lib/period";

/**
 * 브라우저가 원본에서 뽑아 보낸 촬영 정보.
 * 로또는 회원이 직접 신고한 km 기록이라 검토 필요가 빙고보다 크다.
 */
function readLottoMeta(form) {
  try {
    return sanitizePhotoMetadata(JSON.parse(String(form?.get("meta") || "null")));
  } catch {
    return null;
  }
}

/** 내 응모 목록 + 추첨 진행 상황(자리별 공개) + 완료 시 전체 결과 */
export const GET = route(async (req) => {
  const user = await requireUser(req);
  const url = new URL(req.url);

  if (isDemoMode()) {
    return url.searchParams.get("summary") === "1" ? demoLottoSummary(user.id) : demoLotto(user.id);
  }

  if (url.searchParams.get("summary") === "1") {
    const [settings, { count, error }] = await Promise.all([
      getSettings(),
      sb().from("lotto_entries").select("id", { count: "exact", head: true }).eq("user_id", user.id).not("slot", "is", null),
    ]);
    if (error) throw new ApiError("응모 현황을 불러오지 못했습니다.", 500);
    return {
      entryCount: count || 0,
      maxEntries: LOTTO_ENTRY_LIMIT,
      uploadStart: settings.upload_start,
      uploadEnd: settings.upload_end,
      drawDate: settings.draw_date,
      winningNumbers: settings.winning_numbers || "",
    };
  }

  // getSettings()와 내 응모 조회는 서로 의존하지 않으므로 동시에 실행해 왕복을 줄인다.
  const [settings, { data: mine, error: mineError }] = await Promise.all([
    getSettings(),
    sb()
      .from("lotto_entries")
      .select("id, slot, digits, photo_path, created_at")
      .eq("user_id", user.id)
      .not("slot", "is", null)
      .order("slot")
      .order("created_at"),
  ]);
  if (mineError) throw new ApiError("응모 목록을 불러오지 못했습니다.", 500);
  const winning = settings.winning_numbers || ""; // 1의 자리 + 소수점 두 자리, 총 3자리
  const complete = winning.length === LOTTO_DRAW_DIGITS;
  const maxEntries = LOTTO_ENTRY_LIMIT;

  const urlMapPromise = signedUrls((mine || []).map((e) => e.photo_path));

  let winners = null;
  let urlMap;
  if (complete) {
    const [{ data: all, error: allError }, urls] = await Promise.all([
      sb().from("lotto_entries").select("digits, users ( nickname )").not("slot", "is", null),
      urlMapPromise,
    ]);
    if (allError) throw new ApiError("추첨 결과를 계산하지 못했습니다.", 500);
    winners = computeWinners(all, winning);
    urlMap = urls;
  } else {
    urlMap = await urlMapPromise;
  }

  return {
    entries: (mine || []).slice(0, LOTTO_ENTRY_LIMIT).map((e, index) => ({
      id: e.id,
      slot: e.slot || index + 1,
      digits: e.digits,
      hasPhoto: Boolean(e.photo_path),
      photoUrl: urlMap[e.photo_path] || null,
      createdAt: e.created_at,
      matches: complete ? matchCount(e.digits, winning) : null,
    })),
    maxEntries,
    uploadStart: settings.upload_start,
    uploadEnd: settings.upload_end,
    drawDate: settings.draw_date,
    winningNumbers: winning,
    lottoRound: currentLottoRound(settings.lotto_rounds),
    pastLottoRounds: parseLottoRounds(settings.lotto_rounds),
    winners,
    photosLoaded: true,
  };
});

/** 로또 응모: digits("0524") + 사진 (기간 내라면 추첨 진행과 무관하게 가능) */
export const POST = route(async (req) => {
  const user = await requireUserInUploadPeriod(req);
  if (!isDemoMode()) deferPhotoCleanup();

  const form = await req.formData().catch(() => null);
  const digits = String(form?.get("digits") || "");
  const slot = Number(form?.get("slot"));
  if (!/^\d{4}$/.test(digits)) throw new ApiError("기록은 숫자 4자리(xx.xx)로 입력해주세요.");
  if (!Number.isInteger(slot) || slot < 1 || slot > LOTTO_ENTRY_LIMIT) {
    throw new ApiError("잘못된 응모권입니다.");
  }

  // 빙고와 같은 규칙 — 이벤트 기간 전에 찍은 사진은 응모에도 쓸 수 없다.
  // 사진을 올리기 전에 판단해야 헛일과 뒷정리가 안 생긴다.
  const photoMeta = readLottoMeta(form);
  const settings = await getSettings();
  if (takenBeforeEvent(photoMeta, settings.upload_start)) {
    throw new ApiError(
      `이벤트 시작(${formatKoreanDateTime(settings.upload_start)}) 전에 찍은 사진은 응모에 쓸 수 없어요. 기간에 찍은 사진으로 올려주세요.`,
      403
    );
  }

  if (isDemoMode()) {
    if (!form?.get("file")) throw new ApiError("사진 파일이 없습니다.");
    const result = demoLottoAdd(user.id, digits, slot, photoMeta);
    if (result.error) throw new ApiError(result.error);
    return result;
  }
  const buffer = await readPhoto(form);

  const { data: occupied, error: occupiedError } = await sb()
    .from("lotto_entries")
    .select("id")
    .eq("user_id", user.id)
    .eq("slot", slot)
    .maybeSingle();
  requireDbSuccess(occupiedError, "응모권을 확인하지 못했습니다");
  if (occupied) throw new ApiError(`응모권 ${slot}은 이미 사용했습니다.`);

  const path = `lotto/${user.id}/slot-${slot}-${crypto.randomUUID()}.jpg`;
  await uploadPhoto(path, buffer);
  const { data: entry, error } = await sb()
    .from("lotto_entries")
    .insert({ user_id: user.id, slot, digits, photo_path: path })
    .select("id, slot, digits, created_at")
    .single();
  if (error) {
    await schedulePhotoCleanup([path]);
    // 더블 클릭 등으로 같은 슬롯에 동시 응모하면 unique 제약이 막는다.
    if (error.code === "23505") throw new ApiError(`응모권 ${slot}은 이미 사용했습니다.`);
    throw new ApiError("응모 실패: " + error.message, 500);
  }

  // 촬영 정보는 검토용 부가 기록이라 따로 넣고, 실패해도 응모 자체는 살린다.
  // (photo_meta 컬럼 마이그레이션 전에 배포돼도 회원 응모가 멈추지 않는다 — 빙고와 같은 방식)
  if (photoMeta) {
    const { error: metaError } = await sb()
      .from("lotto_entries")
      .update({ photo_meta: photoMeta })
      .eq("id", entry.id);
    if (metaError) console.error("[lotto] photo metadata not stored", metaError);
  }
  return {
    ok: true,
    entry: {
      id: entry.id,
      slot: entry.slot,
      digits: entry.digits,
      hasPhoto: true,
      photoUrl: null,
      createdAt: entry.created_at,
      matches: null,
    },
  };
});

/** 내 응모 취소 (기간 내) */
export const DELETE = route(async (req) => {
  const user = await requireUserInUploadPeriod(req);
  if (!isDemoMode()) deferPhotoCleanup();

  const { id } = await readJson(req);
  if (isDemoMode()) {
    const result = demoLottoRemove(user.id, id);
    if (result.error) throw new ApiError(result.error, result.status);
    return result;
  }
  const { data: entry, error: lookupError } = await sb()
    .from("lotto_entries")
    .select("id, photo_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  requireDbSuccess(lookupError, "응모권을 확인하지 못했습니다");
  if (!entry) throw new ApiError("응모를 찾을 수 없습니다.", 404);

  const { error } = await sb().from("lotto_entries").delete().eq("id", entry.id);
  requireDbSuccess(error, "응모 취소에 실패했습니다");
  const cleanup = await schedulePhotoCleanup([entry.photo_path]);
  return { ok: true, cleanupPending: cleanup.pending };
});
