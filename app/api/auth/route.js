import { sb, userHasBoard } from "@/lib/db";
import { hashPin, verifyPin, newToken } from "@/lib/auth";
import { route, readJson, ApiError } from "@/lib/api";

/** 가입/로그인 겸용: 닉네임이 없으면 가입, 있으면 PIN 검증 */
export const POST = route(async (req) => {
  const { nickname, pin } = await readJson(req);

  const name = String(nickname || "").trim();
  if (name.length < 1 || name.length > 12) throw new ApiError("닉네임은 1~12자로 입력해주세요.");
  if (!/^\d{4}$/.test(String(pin || ""))) throw new ApiError("비밀번호는 숫자 4자리입니다.");

  const { data: existing } = await sb()
    .from("users")
    .select("id, nickname, pin_hash, token")
    .eq("nickname", name)
    .single();

  let user = existing;
  let isNew = false;

  if (existing) {
    if (!verifyPin(String(pin), existing.pin_hash)) throw new ApiError("비밀번호가 틀렸습니다.", 401);
  } else {
    isNew = true;
    const { data, error } = await sb()
      .from("users")
      .insert({ nickname: name, pin_hash: hashPin(String(pin)), token: newToken() })
      .select("id, nickname, token")
      .single();
    if (error) throw new ApiError("가입 실패: " + error.message, 500);
    user = data;
  }

  return {
    token: user.token,
    nickname: user.nickname,
    hasBoard: await userHasBoard(user.id),
    isNew,
  };
});
