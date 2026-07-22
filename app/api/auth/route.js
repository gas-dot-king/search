import { sb } from "@/lib/db";
import { hashPin, verifyPin, newToken, json, err } from "@/lib/auth";

/** 가입/로그인 겸용: 닉네임이 없으면 가입, 있으면 PIN 검증 */
export async function POST(req) {
  const { nickname, pin } = await req.json().catch(() => ({}));

  const name = String(nickname || "").trim();
  if (name.length < 1 || name.length > 12) return err("닉네임은 1~12자로 입력해주세요.");
  if (!/^\d{4}$/.test(String(pin || ""))) return err("비밀번호는 숫자 4자리입니다.");

  const { data: existing } = await sb().from("users").select("*").eq("nickname", name).single();

  let user = existing;
  let isNew = false;

  if (existing) {
    if (!verifyPin(String(pin), existing.pin_hash)) return err("비밀번호가 틀렸습니다.", 401);
  } else {
    isNew = true;
    const { data, error } = await sb()
      .from("users")
      .insert({ nickname: name, pin_hash: hashPin(String(pin)), token: newToken() })
      .select()
      .single();
    if (error) return err("가입 실패: " + error.message, 500);
    user = data;
  }

  const { count } = await sb()
    .from("cells")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  return json({ token: user.token, nickname: user.nickname, hasBoard: (count || 0) > 0, isNew });
}
