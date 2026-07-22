import { getUser, isAdmin } from "./auth";
import { getSettings, inUploadPeriod } from "./settings";

/** 상태코드를 가진 API 오류 — route()가 응답으로 변환 */
export class ApiError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

/** 라우트 핸들러 래퍼: 반환 객체 → JSON, 예외 → {error} 응답 */
export function route(fn) {
  return async (req, ctx) => {
    try {
      return Response.json(await fn(req, ctx));
    } catch (e) {
      const status = e instanceof ApiError ? e.status : 500;
      return Response.json({ error: e.message || "서버 오류가 발생했습니다." }, { status });
    }
  };
}

export async function requireUser(req) {
  const user = await getUser(req);
  if (!user) throw new ApiError("로그인이 필요합니다.", 401);
  return user;
}

export function requireAdmin(req) {
  if (!isAdmin(req)) throw new ApiError("관리자 인증 실패", 401);
}

/** 업로드 기간 검사 후 설정 반환 */
export async function requireUploadPeriod() {
  const settings = await getSettings();
  if (!inUploadPeriod(settings)) throw new ApiError("지금은 업로드 기간이 아닙니다.");
  return settings;
}

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 리사이즈된 JPEG 기준 넉넉한 상한

/** multipart form에서 사진 파일 추출 + 검증 → Buffer */
export async function readPhoto(form) {
  const file = form?.get("file");
  if (!file || typeof file.arrayBuffer !== "function") throw new ApiError("사진 파일이 없습니다.");
  if (file.size > MAX_PHOTO_BYTES) throw new ApiError("사진이 너무 큽니다. (5MB 이하)");
  return Buffer.from(await file.arrayBuffer());
}

export async function readJson(req) {
  return req.json().catch(() => ({}));
}
