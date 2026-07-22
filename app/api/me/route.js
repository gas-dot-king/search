import { sb } from "@/lib/db";
import { getUser, json, err } from "@/lib/auth";

/** 저장된 토큰으로 자동 로그인 */
export async function GET(req) {
  const user = await getUser(req);
  if (!user) return err("로그인이 필요합니다.", 401);

  const { count } = await sb()
    .from("cells")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  return json({ nickname: user.nickname, hasBoard: (count || 0) > 0 });
}
