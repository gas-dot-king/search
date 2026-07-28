import { sb, userHasBoard } from "@/lib/db";
import { hashPin, verifyPin, newToken } from "@/lib/auth";
import { route, readJson, ApiError } from "@/lib/api";
import { demoAuth, demoHasBoard, isDemoMode } from "@/lib/demo";

/** 가입/로그인 겸용: 닉네임이 없으면 가입, 있으면 PIN 검증 */
export const POST = route(async (req) => {
  const { nickname, pin } = await readJson(req);

  const name = String(nickname || "").trim();
  if (name.length < 1 || name.length > 12) throw new ApiError("닉네임은 1~12자로 입력해주세요.");
  if (!/^\d{4}$/.test(String(pin || ""))) throw new ApiError("비밀번호는 숫자 4자리입니다.");

  if (isDemoMode()) {
    const result = demoAuth(name, String(pin));
    if (result.error) throw new ApiError(result.error, result.status);
    return {
      token: result.user.token, nickname: result.user.nickname,
      hasBoard: demoHasBoard(result.user.id), isNew: result.isNew,
    };
  }

  const { data: existing } = await sb()
    .from("users")
    .select("id, nickname, pin_hash, token")
    .eq("nickname", name)
    .single();

  let user = existing;
  let isNew = false;

  if (existing) {
    if (!(await verifyPin(String(pin), existing.pin_hash))) throw new ApiError("비밀번호가 틀렸습니다.", 401);
  } else {
    isNew = true;
    const { data, error } = await sb()
      .from("users")
      .insert({ nickname: name, pin_hash: await hashPin(String(pin)), token: newToken() })
      .select("id, nickname, token")
      .single();
    if (error) {
      // 동시에 같은 닉네임으로 가입한 경우 unique 제약이 막는다 → 재시도 안내
      if (error.code === "23505") throw new ApiError("방금 같은 닉네임으로 가입되었어요. 다시 입장을 눌러주세요.", 409);
      throw new ApiError("가입 실패: " + error.message, 500);
    }
    user = data;
  }

  return {
    token: user.token,
    nickname: user.nickname,
    hasBoard: isNew ? false : await userHasBoard(user.id),
    isNew,
  };
});
