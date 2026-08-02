const SAFE_CURSOR_ID = /^[A-Za-z0-9_-]{1,100}$/;
const SAFE_CURSOR_TIME = /^\d{4}-\d{2}-\d{2}T[0-9:.+Z-]+$/;

export function encodeRecentCursor(row) {
  return Buffer.from(JSON.stringify({ at: row.uploaded_at, id: row.id })).toString("base64url");
}

export function decodeRecentCursor(value) {
  if (!value) return null;

  try {
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    const at = String(decoded.at || "");
    const id = String(decoded.id || "");
    if (!SAFE_CURSOR_TIME.test(at) || Number.isNaN(Date.parse(at))) return null;
    if (!SAFE_CURSOR_ID.test(id)) return null;
    return { at, id };
  } catch {
    // 이전 배포가 발급한 timestamp 커서는 한 페이지 동안만 호환한다.
    if (SAFE_CURSOR_TIME.test(value) && !Number.isNaN(Date.parse(value))) return { at: value, id: null };
    return null;
  }
}
