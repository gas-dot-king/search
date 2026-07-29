import { sb } from "@/lib/db";
import { hashPin, newToken, verifyPin } from "@/lib/auth";
import { ApiError, readJson, requireDbSuccess, requireUser, route } from "@/lib/api";
import { demoChangePin, isDemoMode } from "@/lib/demo";

/** 현재 PIN을 확인한 뒤 PIN과 로그인 토큰을 함께 교체합니다. */
export const PATCH = route(async (req) => {
  const user = await requireUser(req);
  const { currentPin, newPin, newPinConfirm } = await readJson(req);
  const current = String(currentPin || "");
  const next = String(newPin || "");

  if (!/^\d{4}$/.test(current)) throw new ApiError("현재 PIN은 숫자 4자리로 입력해주세요.");
  if (!/^\d{4}$/.test(next)) throw new ApiError("새 PIN은 숫자 4자리로 입력해주세요.");
  if (next !== String(newPinConfirm || "")) throw new ApiError("새 PIN 확인이 일치하지 않습니다.");
  if (current === next) throw new ApiError("현재 PIN과 다른 새 PIN을 입력해주세요.");

  if (isDemoMode()) {
    const result = demoChangePin(user.id, current, next);
    if (result.error) throw new ApiError(result.error, result.status);
    return { ok: true, token: result.token };
  }

  const { data: account, error: lookupError } = await sb()
    .from("users")
    .select("pin_hash")
    .eq("id", user.id)
    .single();
  requireDbSuccess(lookupError, "계정 정보를 확인하지 못했습니다");

  if (!(await verifyPin(current, account.pin_hash))) {
    throw new ApiError("현재 PIN이 맞지 않습니다.", 401);
  }

  const token = newToken();
  const pinHash = await hashPin(next);
  const { error: updateError } = await sb()
    .from("users")
    .update({ pin_hash: pinHash, token })
    .eq("id", user.id)
    .eq("pin_hash", account.pin_hash)
    .select("id")
    .single();
  if (updateError?.code === "PGRST116") {
    throw new ApiError("PIN이 이미 변경되었습니다. 새 PIN으로 다시 로그인해주세요.", 409);
  }
  requireDbSuccess(updateError, "PIN을 변경하지 못했습니다");

  return { ok: true, token };
});
