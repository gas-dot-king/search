/**
 * 오프라인 행사 방명록.
 *
 * 한 사람이 여러 번 남길 수 있고, 자기 글은 언제든 고치거나 지운다.
 */
export const GUESTBOOK_MAX_LENGTH = 200;

/**
 * 한 사람이 남길 수 있는 글 수.
 * 로그인만 하면 누구나 쓰는 공개 화면이라, 한 사람이 목록을 통째로 덮는 것만 막는다.
 */
export const GUESTBOOK_MAX_PER_USER = 10;

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

/** 이미 쓴 글이 상한에 닿았는지. 문제가 없으면 빈 문자열. */
export function guestbookCountError(count) {
  if (count >= GUESTBOOK_MAX_PER_USER) {
    return `방명록은 한 사람당 ${GUESTBOOK_MAX_PER_USER}개까지 남길 수 있어요. 이전 글을 수정하거나 지워주세요.`;
  }
  return "";
}

/** 목록 정렬: 최신 글이 위로. 시각이 같으면 id로 안정 정렬한다. */
export function sortGuestbookEntries(entries) {
  return [...entries].sort(
    (a, b) =>
      Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
      String(a.id).localeCompare(String(b.id))
  );
}
