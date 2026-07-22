export const MAX_NOTICES = 5;

/** settings.notice 값 파싱: JSON 배열 또는 (예전 형식) 단일 문자열 */
export function parseNotices(raw) {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.map(String).filter(Boolean).slice(0, MAX_NOTICES);
    return [String(arr)];
  } catch {
    return [String(raw)];
  }
}
