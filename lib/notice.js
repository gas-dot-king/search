export const NOTICE_HIDDEN_UNTIL_KEY = "ysrc-notice-hidden-until";
export const NOTICE_ONE_DAY_MS = 24 * 60 * 60 * 1000;
export const NOTICE_VISIBILITY_EVENT = "ysrc-notice-visibility-changed";

export function hideNoticeForDay() {
  try {
    localStorage.setItem(NOTICE_HIDDEN_UNTIL_KEY, String(Date.now() + NOTICE_ONE_DAY_MS));
  } catch {
    // 저장소가 막힌 환경에서는 현재 화면에서만 닫는다.
  }
  window.dispatchEvent(new Event(NOTICE_VISIBILITY_EVENT));
}
