/**
 * 오프라인 행사 방명록.
 *
 * 한 사람이 글 하나를 남기고 고쳐 쓰는 형태다. 행사 당일 한 페이지에서
 * 전부 읽히는 것이 목적이라, 여러 장 쓰기보다 한 장을 다듬게 했다.
 */
export const GUESTBOOK_MAX_LENGTH = 200;

/** 한 화면에 담을 최대 글 수. 크루 규모상 넘길 일은 없지만 응답 크기를 묶어 둔다. */
export const GUESTBOOK_LIMIT = 200;

/**
 * 저장 전 메시지를 다듬는다.
 * 줄바꿈은 살리되(여러 줄 인사가 자연스럽다) 빈 줄 도배는 접는다.
 */
export function normalizeGuestbookMessage(value) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** 다듬은 메시지의 문제를 사용자 문구로 돌려준다. 문제가 없으면 빈 문자열. */
export function guestbookMessageError(message) {
  if (!message) return "방명록에 남길 내용을 입력해주세요.";
  if (message.length > GUESTBOOK_MAX_LENGTH) {
    return `방명록은 ${GUESTBOOK_MAX_LENGTH}자까지 쓸 수 있어요.`;
  }
  return "";
}

/**
 * 입력값을 다듬고 검증까지 한 번에 처리한다.
 * 라우트와 데모 분기가 같은 규칙을 쓰도록 여기 한곳에 둔다.
 */
export function readGuestbookMessage(value) {
  const message = normalizeGuestbookMessage(value);
  return { message, error: guestbookMessageError(message) };
}

/** 목록 정렬: 최신 글이 위로. 시각이 같으면 id로 안정 정렬한다. */
export function sortGuestbookEntries(entries) {
  return [...entries].sort(
    (a, b) =>
      Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
      String(a.id).localeCompare(String(b.id))
  );
}
