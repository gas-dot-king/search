import { hashToken, newToken, sessionExpiresAt } from "@/lib/auth";
import { sb } from "@/lib/db";
import { ApiError, requireDbSuccess, requireUser, route } from "@/lib/api";
import { isDemoMode } from "@/lib/demo";

/** Explicit sign-out: rotate the server token before the browser drops it. */
export const DELETE = route(async (req) => {
  const user = await requireUser(req);
  if (isDemoMode()) return { ok: true };

  const { data, error } = await sb()
    .from("users")
    .update({ token_hash: hashToken(newToken()), token_expires_at: sessionExpiresAt() })
    .eq("id", user.id)
    .select("id")
    .maybeSingle();
  requireDbSuccess(error, "로그아웃 처리에 실패했습니다");
  if (!data) throw new ApiError("로그아웃할 계정을 찾지 못했습니다.", 404);
  return { ok: true };
});
