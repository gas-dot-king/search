import { getUser, isAdmin } from "./auth";
import { getSettings } from "./settings";
import { inUploadPeriod, uploadPeriodNotice } from "./period";

/** 상태코드를 가진 API 오류 — route()가 응답으로 변환 */
export class ApiError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Supabase 쓰기 오류를 일관된 API 오류로 변환합니다. */
export function requireDbSuccess(error, message = "데이터 처리에 실패했습니다.") {
  if (error) throw new ApiError(`${message}: ${error.message}`, 500);
}

/** 라우트 핸들러 래퍼: 반환 객체 → JSON, 예외 → {error} 응답 */
export function route(fn) {
  return async (req, ctx) => {
    try {
      const result = await fn(req, ctx);
      return result instanceof Response ? result : Response.json(result);
    } catch (e) {
      const status = e instanceof ApiError ? e.status : 500;

      // 4xx는 사용자에게 보여주려고 지은 문구라 그대로 전달한다.
      // 5xx는 "응모 실패: <Postgres 오류>"처럼 스키마·호스트 같은 내부 사정이
      // 메시지에 섞여 나가므로, 브라우저에는 일반 문구만 주고 원본은 로그로 남긴다.
      // (로그가 없으면 사용자만 내부를 보고 운영자는 장애를 모르는 상태가 된다.)
      if (status >= 500) {
        console.error(`[api] ${req.method} ${req.url}`, e);
        return Response.json(
          { error: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요." },
          { status }
        );
      }
      return Response.json({ error: e.message || "요청을 처리하지 못했습니다." }, { status });
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

/**
 * 업로드·응모 기간 검사 후 설정 반환.
 * 데모 모드에서도 똑같이 막는다 — 기간 밖 동작을 데모로 확인할 수 있어야 하고,
 * 데모에서 기간을 옮기려면 관리자 화면에서 upload_start/upload_end를 바꾸면 된다.
 */
export async function requireUploadPeriod() {
  const settings = await getSettings();
  if (!inUploadPeriod(settings)) throw new ApiError(uploadPeriodNotice(settings), 403);
  return settings;
}

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 리사이즈된 JPEG 기준 넉넉한 상한

/** multipart form에서 사진 파일 추출 + 검증 → Buffer */
export async function readPhoto(form) {
  const file = form?.get("file");
  if (!file || typeof file.arrayBuffer !== "function") throw new ApiError("사진 파일이 없습니다.");
  if (file.size > MAX_PHOTO_BYTES) throw new ApiError("사진이 너무 큽니다. (5MB 이하)");
  const buffer = Buffer.from(await file.arrayBuffer());
  // 정상 흐름은 항상 브라우저 리사이즈를 거친 JPEG(FF D8 FF)라서, 다른 형식은 저장 전에 거른다.
  if (buffer.length < 3 || buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[2] !== 0xff) {
    throw new ApiError("사진 형식을 인식하지 못했어요. 앱에서 사진을 다시 선택해주세요.");
  }
  return buffer;
}

export async function readJson(req) {
  return req.json().catch(() => ({}));
}
