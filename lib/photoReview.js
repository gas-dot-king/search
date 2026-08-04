// 인증 사진을 검토할 때 관리자에게 보여줄 값들.
// 회원 상세와 최근 인증 큐가 같은 기준으로 판단하도록 한곳에 모아 둔다.
//
// EXIF는 편집으로 바꿀 수 있어 증거가 아니라 참고용이다. 여기서 하는 일은
// "눈여겨볼 사진"을 위로 끌어올리는 것뿐이고, 판단은 사람이 한다.

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 촬영 시각을 실제 시점(ms)으로 바꾼다.
 * EXIF의 takenAt에는 시간대가 없다. 기기가 남긴 utcOffset이 있으면 그걸 쓰고,
 * 없으면 한국에서 찍은 것으로 본다 — 크루 이벤트라 대부분 맞다.
 */
export function takenAtMs(meta) {
  if (!meta?.takenAt) return null;
  const raw = String(meta.utcOffset || "");
  const offset = /^[+-]\d{2}:\d{2}$/.test(raw) ? raw : "+09:00";
  const ms = Date.parse(`${meta.takenAt}${offset}`);
  return Number.isNaN(ms) ? null : ms;
}

/** "2026-08-02T15:10:28" → "08-02 15:10" (초는 검토에 쓸모가 없다) */
function takenLabel(meta) {
  if (!meta?.takenAt) return null;
  const match = String(meta.takenAt).match(/^\d{4}-(\d{2}-\d{2})T(\d{2}:\d{2})/);
  return match ? `${match[1]} ${match[2]}` : null;
}

/**
 * 이벤트가 시작되기 전에 찍은 사진인지.
 *
 * 이것만이 규칙으로 확실한 위반이다 — 이벤트 기간 밖에 찍은 사진은 어떤 해석으로도
 * 이번 인증이 될 수 없다. (촬영 후 며칠 뒤에 올리는 건 규칙 위반이 아니다)
 *
 * 촬영 정보가 없으면(스크린샷·메신저로 받은 사진) 알 수 없으므로 막지 않는다.
 * 기록 달성 칸은 러닝 앱 화면 캡처가 정상이라 EXIF가 없는 게 오히려 흔하다.
 */
export function takenBeforeEvent(meta, uploadStart) {
  const takenMs = takenAtMs(meta);
  if (takenMs === null) return false;
  const startMs = Date.parse(uploadStart);
  // 설정을 못 읽었으면 막지 않는다 — 판단이 안 서는데 인증을 막는 쪽이 더 나쁘다.
  if (Number.isNaN(startMs)) return false;
  return takenMs < startMs;
}

// 한국은 서머타임이 없어 UTC+9 고정이다. Intl 로케일 데이터가 빠진 런타임에서도
// 같은 값이 나오도록 날짜 경계를 직접 계산한다.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** now가 속한 한국 날짜의 자정(ms). "오늘 찍었는지" 판정의 기준선이다. */
export function startOfSeoulDay(now = new Date()) {
  const kst = now.getTime() + KST_OFFSET_MS;
  return Math.floor(kst / DAY_MS) * DAY_MS - KST_OFFSET_MS;
}

/**
 * 오늘(한국 시간) 찍은 사진이 아닌지 — 빙고 인증은 당일 사진만 받는다.
 *
 * 어제 달린 기록을 오늘 올리는 걸 막는 규칙이다. 하루 3칸 제한이 있어서, 미리 찍어 둔
 * 사진을 며칠에 걸쳐 나눠 올리면 그날 활동하지 않고도 칸이 채워진다.
 *
 * takenBeforeEvent와 같은 이유로 촬영 정보가 없으면 막지 않는다 — 러닝 앱 화면 캡처에는
 * EXIF가 없어서, 막으면 기록 달성 칸을 아무도 채울 수 없다.
 *
 * 기기 시계가 앞서 미래로 찍힌 사진도 여기서는 막지 않는다. 시계가 몇 분 빠른 것뿐인데
 * 정상 인증이 거절되는 쪽이 더 나쁘다 — 그런 사진은 검토 큐가 따로 짚어 준다.
 */
export function takenBeforeToday(meta, now = new Date()) {
  const takenMs = takenAtMs(meta);
  if (takenMs === null) return false;
  return takenMs < startOfSeoulDay(now);
}

/**
 * 사진 한 장의 검토 정보.
 * @param {object|null} meta cells.photo_meta
 * @param {string|null} uploadedAt 업로드 시각(ISO)
 * @param {string|null} uploadStart 이벤트 시작 시각(ISO). 주면 기간 전 촬영을 짚어 준다.
 */
export function photoReview(meta, uploadedAt, uploadStart = null) {
  const hasMeta = Boolean(meta && Object.keys(meta).length > 0);
  const uploadedMs = uploadedAt ? Date.parse(uploadedAt) : NaN;
  const takenMs = takenAtMs(meta);

  // 촬영과 업로드가 하루 이상 벌어지면 예전 사진일 수 있다.
  // 기기 시계가 틀리면 미래로도 벌어지므로 양쪽 다 본다.
  let gapDays = null;
  if (takenMs !== null && !Number.isNaN(uploadedMs)) {
    gapDays = Math.floor((uploadedMs - takenMs) / DAY_MS);
  }

  const device = [meta?.make, meta?.model].filter(Boolean).join(" ") || null;
  const hasGps = Number.isFinite(meta?.lat) && Number.isFinite(meta?.lng);

  const beforeEvent = takenBeforeEvent(meta, uploadStart);

  // flag는 "규칙에 어긋난다", note는 "참고로 알아 두라"는 뜻이다. 섞으면 안 된다 —
  // 며칠 전에 찍은 사진을 올리는 건 위반이 아닌데 경고로 보이면 운영진이 헛일을 한다.
  let flag = null;
  if (beforeEvent) flag = "이벤트 시작 전 촬영";
  else if (gapDays != null && gapDays < 0) flag = "촬영 시각이 업로드보다 미래";

  const note = !flag && gapDays != null && gapDays >= 1 ? `${gapDays}일 전 촬영` : null;

  return {
    hasMeta,
    takenLabel: takenLabel(meta),
    utcOffset: meta?.utcOffset || null,
    gapDays,
    device,
    hasGps,
    lat: hasGps ? meta.lat : null,
    lng: hasGps ? meta.lng : null,
    beforeEvent,
    flag,
    note,
  };
}

/** 검토 큐 필터. 값은 화면의 필터 칩과 1:1로 맞춘다. */
export const REVIEW_FILTERS = {
  ALL: "all",
  FLAGGED: "flagged", // 규칙에 어긋난 사진 (이벤트 시작 전 촬영 등)
  NO_META: "no_meta", // 촬영 정보가 아예 없는 사진(스크린샷 등)
};

/** 업로드 한 건이 필터에 걸리는지. uploads 배열을 그대로 거르는 데 쓴다. */
export function matchesReviewFilter(upload, filter, uploadStart = null) {
  const review = photoReview(upload.photoMeta, upload.uploadedAt, uploadStart);
  if (filter === REVIEW_FILTERS.FLAGGED) return Boolean(review.flag);
  if (filter === REVIEW_FILTERS.NO_META) return !review.hasMeta;
  return true;
}
