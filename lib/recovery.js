export const RECOVERY_EVENT_KEY = "server-overload-20260804";
export const RECOVERY_STATES = {
  BEFORE_NOTICE: "before_notice",
  NOTICE: "notice",
  ACTIVE: "active",
  ENDED: "ended",
};

export const DEFAULT_RECOVERY_EVENT = {
  key: RECOVERY_EVENT_KEY,
  noticeAt: "2026-08-03T18:00:00+09:00",
  startAt: "2026-08-04T00:00:00+09:00",
  endAt: "2026-08-05T00:00:00+09:00",
  enabled: true,
  winningDigit: "",
  prizeText: "커피 쿠폰 ☕",
};

function readEvent(raw) {
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : null;
}

function cleanText(value, fallback, maxLength = 120) {
  const text = String(value ?? "").trim().slice(0, maxLength);
  return text || fallback;
}

function cleanDate(value, fallback) {
  const text = cleanText(value, fallback, 32);
  return Number.isNaN(new Date(text).getTime()) ? fallback : text;
}

export function normalizeRecoveryEvent(raw) {
  const source = readEvent(raw) || {};
  const event = {
    key: cleanText(source.key, DEFAULT_RECOVERY_EVENT.key, 80),
    noticeAt: cleanDate(source.noticeAt, DEFAULT_RECOVERY_EVENT.noticeAt),
    startAt: cleanDate(source.startAt, DEFAULT_RECOVERY_EVENT.startAt),
    endAt: cleanDate(source.endAt, DEFAULT_RECOVERY_EVENT.endAt),
    enabled: source.enabled !== false,
    winningDigit: /^\d$/.test(String(source.winningDigit ?? "")) ? String(source.winningDigit) : "",
    prizeText: cleanText(source.prizeText, DEFAULT_RECOVERY_EVENT.prizeText, 160),
  };

  if (new Date(event.startAt) <= new Date(event.noticeAt)) event.noticeAt = DEFAULT_RECOVERY_EVENT.noticeAt;
  if (new Date(event.endAt) <= new Date(event.startAt)) event.endAt = DEFAULT_RECOVERY_EVENT.endAt;
  return event;
}

export function serializeRecoveryEvent(raw) {
  return JSON.stringify(normalizeRecoveryEvent(raw));
}

export function recoveryState(raw, now = new Date()) {
  const event = normalizeRecoveryEvent(raw);
  if (!event.enabled) return RECOVERY_STATES.BEFORE_NOTICE;
  const time = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const notice = new Date(event.noticeAt).getTime();
  const start = new Date(event.startAt).getTime();
  const end = new Date(event.endAt).getTime();
  if (time < notice) return RECOVERY_STATES.BEFORE_NOTICE;
  if (time < start) return RECOVERY_STATES.NOTICE;
  if (time < end) return RECOVERY_STATES.ACTIVE;
  return RECOVERY_STATES.ENDED;
}

export function recoveryIsActive(raw, now = new Date()) {
  return recoveryState(raw, now) === RECOVERY_STATES.ACTIVE;
}

export function recoveryTicketDigit(ticketNo) {
  return Math.abs(Number(ticketNo) || 0) % 10;
}

export function recoveryTicketLabel(ticketNo) {
  return `YSRC-RCV-${String(ticketNo).padStart(4, "0")}`;
}

/** 접수번호를 "끝자리 앞"과 "끝자리"로 나눈다 — 끝자리만 크게 강조하려고 */
export function splitRecoveryTicket(ticketNo) {
  const label = recoveryTicketLabel(ticketNo);
  return { head: label.slice(0, -1), tail: label.slice(-1) };
}

/** 추첨 안내. 화면 여러 곳에서 같은 말을 하도록 한곳에 둔다. */
export const RECOVERY_DRAW_GUIDE = {
  how: "0~9 중 숫자 하나를 무작위로 뽑아, 접수번호 끝자리가 같으면 당첨이에요.",
  when: "내일 중에 추첨하고 이 화면에 결과를 올립니다.",
  prize: "당첨되면 커피 쿠폰 ☕",
};

export function randomRecoveryTicket(random = Math.random) {
  return Math.floor(random() * 900000) + 100000;
}

/**
 * ticket_no가 아직 identity 컬럼인 스키마인가.
 * 20260803000001 마이그레이션 전에는 GENERATED ALWAYS AS IDENTITY라서
 * 접수번호를 직접 넣으면 Postgres가 거부한다(428C9).
 */
export function isIdentityTicketError(error) {
  if (!error) return false;
  if (String(error.code || "") === "428C9") return true;
  const message = String(error.message || "");
  return /non-DEFAULT value into column/i.test(message) || /GENERATED ALWAYS/i.test(message);
}

export function isRecoveryTicketCollision(error) {
  return error?.code === "23505" && String(error.message || "").includes("recovery_entries_pkey");
}

// 참여를 부르는 문구라 DB 설정과 별개로 화면에 고정한다. prizeText는 당첨 결과에 쓰고,
// 이 문구는 "참여하면 뭐가 좋은지"를 팝업·제출 화면에서 알린다.
/**
 * 복구가 진행 중일 때 복구 인증센터로 돌려보낼 화면들.
 * 인증이 잠긴 화면을 보여줄 이유가 없다. 다만 복구센터 자신과 입장 화면,
 * 설정·FAQ·명예의 전당·관리자는 열어 둔다 — 막으면 문의 창구까지 사라진다.
 */
export const RECOVERY_GATED_PATHS = ["/board", "/lotto", "/challenge", "/event", "/draw", "/feed"];

/**
 * 다음 상태 변화까지 남은 밀리초. 없으면 null.
 * 매초 확인하는 대신 이 시각에 한 번만 깨어나면 된다.
 */
export function msUntilRecoveryChange(raw, now = new Date()) {
  const event = normalizeRecoveryEvent(raw);
  if (!event.enabled) return null;
  const time = now instanceof Date ? now.getTime() : new Date(now).getTime();
  for (const at of [event.noticeAt, event.startAt, event.endAt]) {
    const boundary = new Date(at).getTime();
    if (Number.isFinite(boundary) && boundary > time) return boundary - time;
  }
  return null;
}

export function isRecoveryGatedPath(pathname) {
  if (!pathname) return false;
  return RECOVERY_GATED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export const RECOVERY_PRIZE_NOTE = "🎁 복구에 참여하고 당첨되면 커피 쿠폰을 드려요 ☕";

// 팝업을 닫아도 다시 알리기까지의 간격.
export const RECOVERY_HIDE_HOUR_MS = 60 * 60 * 1000;

/** 팝업 숨김 만료 시각을 저장할 이벤트별 키 */
export function recoveryHideKey(event) {
  const key = String(event?.key || "recovery").slice(0, 80);
  return `ow_recovery_hidden_${key}`;
}

export function recoveryNotice(event, state) {
  if (state === RECOVERY_STATES.NOTICE) return "오늘 자정부터 긴급 복구에 들어갑니다. 서버를 식히는 동안 복구 인증센터를 준비해주세요.";
  if (state === RECOVERY_STATES.ACTIVE) return "인증 서버 긴급 복구 중입니다. 기존 기록은 안전하며, 복구 인증센터만 이용할 수 있어요.";
  if (state === RECOVERY_STATES.ENDED) return "서버 복구가 완료되었습니다. 기존 빙고·로또 인증을 다시 이용할 수 있어요.";
  return "";
}

