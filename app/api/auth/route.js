import { sb, userHasBoard } from "@/lib/db";
import { hashPin, hashToken, newToken, sessionExpiresAt, verifyPin } from "@/lib/auth";
import { route, readJson, ApiError, requireDbSuccess } from "@/lib/api";
import { demoAuth, demoHasBoard, isDemoMode } from "@/lib/demo";
import { takeRateLimit } from "@/lib/rateLimit";
import { maskedClientIp } from "@/lib/ip";

const LOCKED_PIN_MESSAGE = "PIN을 10회 잘못 입력해 잠겼습니다. 관리자에게 PIN 초기화를 문의해주세요.";

/** 가입 또는 로그인. PIN 실패 횟수는 계정 단위로 영구 추적한다. */
export const POST = route(async (req) => {
  const { nickname, pin } = await readJson(req);
  const name = String(nickname || "").trim();
  const pinValue = String(pin || "");

  if (name.length < 1 || name.length > 12) throw new ApiError("닉네임은 1~12자로 입력해주세요.");
  if (!/^\d{4}$/.test(pinValue)) throw new ApiError("PIN은 숫자 4자리입니다.");

  const allowed = await takeRateLimit(req, "login", name, { limit: 30, windowSeconds: 10 * 60 });
  if (!allowed) throw new ApiError("로그인 요청이 너무 많아요. 10분 뒤 다시 시도해주세요.", 429);
  const ipAllowed = await takeRateLimit(req, "login-ip", "all", { limit: 100, windowSeconds: 10 * 60 });
  const loginIp = maskedClientIp(req);
  if (!ipAllowed) throw new ApiError("로그인 요청이 너무 많아요. 10분 뒤 다시 시도해주세요.", 429);

  if (isDemoMode()) {
    const result = demoAuth(name, pinValue);
    if (result.error) throw new ApiError(result.error, result.status);
    return {
      token: result.user.token,
      nickname: result.user.nickname,
      hasBoard: demoHasBoard(result.user.id),
      isNew: result.isNew,
    };
  }

  const { data: existing, error: lookupError } = await sb()
    .from("users")
    .select("id, nickname, pin_hash, failed_pin_attempts, pin_locked_at")
    .eq("nickname", name)
    .maybeSingle();
  requireDbSuccess(lookupError, "계정을 확인하지 못했습니다");

  if (existing) {
    if (existing.failed_pin_attempts >= 10 || existing.pin_locked_at) {
      throw new ApiError(LOCKED_PIN_MESSAGE, 423);
    }

    if (!(await verifyPin(pinValue, existing.pin_hash))) {
      const { data: failure, error: failureError } = await sb()
        .rpc("record_pin_failure", { p_user_id: existing.id })
        .single();
      requireDbSuccess(failureError, "PIN 실패 횟수를 기록하지 못했습니다");
      if (failure?.failed_pin_attempts >= 10) throw new ApiError(LOCKED_PIN_MESSAGE, 423);
      throw new ApiError("PIN이 맞지 않습니다.", 401);
    }

    // A successful login clears failures and rotates the bearer token. This
    // also makes a copied old token unusable.
    const token = newToken();
    const { data: loggedIn, error: updateError } = await sb()
      .from("users")
      .update({
        token_hash: hashToken(token),
        token_expires_at: sessionExpiresAt(),
      failed_pin_attempts: 0,
      last_login_ip: loginIp,
        pin_locked_at: null,
      })
      .eq("id", existing.id)
      .eq("pin_hash", existing.pin_hash)
      .select("id")
      .maybeSingle();
    requireDbSuccess(updateError, "로그인 세션을 만들지 못했습니다");
    if (!loggedIn) throw new ApiError("PIN이 변경되었습니다. 새 PIN으로 다시 로그인해주세요.", 409);

    return {
      token,
      nickname: existing.nickname,
      hasBoard: await userHasBoard(existing.id),
      isNew: false,
    };
  }

  const token = newToken();
  const { data: user, error: createError } = await sb()
    .from("users")
    .insert({
      nickname: name,
      pin_hash: await hashPin(pinValue),
      token_hash: hashToken(token),
      token_expires_at: sessionExpiresAt(),
      last_login_ip: loginIp,
    })
    .select("id, nickname")
    .single();
  if (createError?.code === "23505") {
    throw new ApiError("방금 같은 닉네임으로 가입되었어요. 다시 입장해 주세요.", 409);
  }
  requireDbSuccess(createError, "가입에 실패했습니다");

  return { token, nickname: user.nickname, hasBoard: false, isNew: true };
});
