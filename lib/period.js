// 업로드·응모 가능 기간 판정. 서버(API 차단)와 클라이언트(버튼 잠금)가 같은 규칙을
// 쓰도록 순수 함수만 모아 둔다. 클라이언트 번들에도 들어가므로 lib/db.js 같은
// 서버 전용 모듈을 import하지 않는다.

export const UPLOAD_PERIOD = {
  BEFORE: "before", // 시작 전 — 보기만 가능
  OPEN: "open", // 기간 중 — 업로드·응모 가능
  CLOSED: "closed", // 마감 후 — 보기만 가능
};

/**
 * 현재 기간 상태를 반환한다.
 * 설정값이 비었거나 형식이 어긋나면 열어주지 않고 잠금(CLOSED)으로 본다.
 */
export function uploadPeriodState(settings, now = new Date()) {
  const start = new Date(settings?.upload_start).getTime();
  const end = new Date(settings?.upload_end).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return UPLOAD_PERIOD.CLOSED;

  const at = now.getTime();
  if (at < start) return UPLOAD_PERIOD.BEFORE;
  if (at > end) return UPLOAD_PERIOD.CLOSED;
  return UPLOAD_PERIOD.OPEN;
}

export function inUploadPeriod(settings, now = new Date()) {
  return uploadPeriodState(settings, now) === UPLOAD_PERIOD.OPEN;
}

// 한국은 서머타임이 없어 UTC+9 고정이다. Intl 로케일 데이터가 빠진 런타임에서
// "오전"이 "AM"으로 나오는 걸 피하려고, 시각 계산과 표기를 직접 한다.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 저장된 ISO 시각을 "8월 1일 오전 6시"처럼 한국 시간으로 표기한다 */
export function formatKoreanDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  const hour24 = kst.getUTCHours();
  const minute = kst.getUTCMinutes();
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const clock = minute === 0 ? `${hour12}시` : `${hour12}시 ${minute}분`;
  return `${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일 ${hour24 < 12 ? "오전" : "오후"} ${clock}`;
}

/**
 * 저장된 ISO 시각을 <input type="datetime-local"> 값(KST 벽시계)으로 바꾼다.
 * 형식이 깨졌으면 빈 문자열 — 입력칸이 비어 보여야 관리자가 잘못된 값을 알아챈다.
 */
export function toKstInputValue(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 16);
}

/**
 * datetime-local 값을 KST 기준 ISO 문자열로 되돌린다.
 * 오프셋을 빼먹으면 서버(UTC)가 9시간 어긋나게 해석하므로 반드시 +09:00을 붙인다.
 */
export function fromKstInputValue(input) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(input)) ? `${input}:00+09:00` : "";
}

/** 기간 밖일 때 사용자·API에 함께 보여줄 안내 문구 (기간 중이면 빈 문자열) */
export function uploadPeriodNotice(settings, now = new Date()) {
  const state = uploadPeriodState(settings, now);
  if (state === UPLOAD_PERIOD.OPEN) return "";

  if (state === UPLOAD_PERIOD.BEFORE) {
    const start = formatKoreanDateTime(settings?.upload_start);
    return start
      ? `${start}부터 인증 사진 업로드와 로또 응모를 할 수 있어요. 지금은 보기만 가능합니다.`
      : "아직 업로드·응모 기간이 시작되지 않았어요. 지금은 보기만 가능합니다.";
  }

  const end = formatKoreanDateTime(settings?.upload_end);
  return end
    ? `${end}에 마감되어 더 이상 업로드·응모할 수 없어요. 기록은 계속 보실 수 있습니다.`
    : "업로드·응모 기간이 종료되었어요. 기록은 계속 보실 수 있습니다.";
}

/** /api/config 응답을 위 함수들이 받는 settings 형태로 바꾼다 */
export function periodSettingsFromConfig(config) {
  return { upload_start: config?.uploadStart, upload_end: config?.uploadEnd };
}
