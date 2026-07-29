import { sb } from "@/lib/db";
import { hashPin, hashToken, newToken, sessionExpiresAt, verifyPin } from "@/lib/auth";
import { ApiError, readJson, requireDbSuccess, requireUser, route } from "@/lib/api";
import { demoChangePin, isDemoMode } from "@/lib/demo";
import { takeRateLimit } from "@/lib/rateLimit";

const LOCKED_PIN_MESSAGE = "PIN을 10회 잘못 입력해 잠겼습니다. 관리자에게 PIN 초기화를 문의해주세요.";

/** PIN 변경도 로그인과 같은 실패 횟수·잠금 규칙을 적용한다. */
export const PATCH = route(async (req) => {
  const user = await requireUser(req);
  const { currentPin, newPin, newPinConfirm } = await readJson(req);
  const current = String(currentPin || "");
  const next = String(newPin || "");

  if (!/^\d{4}$/.test(current)) throw new ApiError("현재 PIN은 숫자 4자리로 입력해주세요.");
  if (!/^\d{4}$/.test(next)) throw new ApiError("새 PIN은 숫자 4자리로 입력해주세요.");
  if (next !== String(newPinConfirm || "")) throw new ApiError("새 PIN 확인이 일치하지 않습니다.");
  if (current === next) throw new ApiError("현재 PIN과 다른 새 PIN을 입력해주세요.");

  const allowed = await takeRateLimit(req, "change-pin", user.id, { limit: 10, windowSeconds: 15 * 60 });
  if (!allowed) throw new ApiError("PIN 변경 요청이 너무 많아요. 잠시 뒤 다시 시도해주세요.", 429);

  if (isDemoMode()) {
    const result = demoChangePin(user.id, current, next);
    if (result.error) throw new ApiError(result.error, result.status);
    return { ok: true, token: result.token };
  }

  const { data: account, error: lookupError } = await sb()
    .from("users")
    .select("pin_hash, failed_pin_attempts, pin_locked_at")
    .eq("id", user.id)
    .single();
  requireDbSuccess(lookupError, "계정 정보를 확인하지 못했습니다");
  if (account.failed_pin_attempts >= 10 || account.pin_locked_at) throw new ApiError(LOCKED_PIN_MESSAGE, 423);

  if (!(await verifyPin(current, account.pin_hash))) {
    const { data: failure, error: failureError } = await sb().rpc("record_pin_failure", { p_user_id: user.id }).single();
    requireDbSuccess(failureError, "PIN 실패 횟수를 기록하지 못했습니다");
    if (failure?.failed_pin_attempts >= 10) throw new ApiError(LOCKED_PIN_MESSAGE, 423);
    throw new ApiError("현재 PIN이 맞지 않습니다.", 401);
  }

  const token = newToken();
  const { data: changed, error: updateError } = await sb()
    .from("users")
    .update({
      pin_hash: await hashPin(next),
      token_hash: hashToken(token),
      token_expires_at: sessionExpiresAt(),
      failed_pin_attempts: 0,
      pin_locked_at: null,
    })
    .eq("id", user.id)
    .eq("pin_hash", account.pin_hash)
    .select("id")
    .maybeSingle();
  requireDbSuccess(updateError, "PIN을 변경하지 못했습니다");
  if (!changed) throw new ApiError("PIN이 이미 변경되었습니다. 새 PIN으로 다시 로그인해주세요.", 409);

  return { ok: true, token };
});
