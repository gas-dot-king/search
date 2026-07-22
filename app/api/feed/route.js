import { sb } from "@/lib/db";
import { getUser, json, err } from "@/lib/auth";
import { countLines } from "@/lib/bingo";

/** 동호회 현황: 진행률 랭킹 + 최근 활동 (사진은 비공개) */
export async function GET(req) {
  const user = await getUser(req);
  if (!user) return err("로그인이 필요합니다.", 401);

  const { data: users } = await sb().from("users").select("id, nickname");
  const { data: cells } = await sb()
    .from("cells")
    .select("user_id, position, uploaded_at")
    .not("photo_path", "is", null);
  const { data: lotto } = await sb()
    .from("lotto_entries")
    .select("user_id, created_at");

  const nickOf = new Map((users || []).map((u) => [u.id, u.nickname]));

  // 랭킹
  const byUser = new Map();
  for (const c of cells || []) {
    if (!byUser.has(c.user_id)) byUser.set(c.user_id, []);
    byUser.get(c.user_id).push(c.position);
  }
  const lottoCount = new Map();
  for (const e of lotto || []) lottoCount.set(e.user_id, (lottoCount.get(e.user_id) || 0) + 1);

  const rankings = (users || [])
    .map((u) => {
      const positions = byUser.get(u.id) || [];
      return {
        nickname: u.nickname,
        filled: positions.length,
        lines: countLines(positions),
        lottoEntries: lottoCount.get(u.id) || 0,
      };
    })
    .sort((a, b) => b.lines - a.lines || b.filled - a.filled || a.nickname.localeCompare(b.nickname));

  // 최근 활동 (텍스트만)
  const activity = [
    ...(cells || []).filter((c) => c.uploaded_at).map((c) => ({
      nickname: nickOf.get(c.user_id) || "?",
      type: "bingo",
      at: c.uploaded_at,
    })),
    ...(lotto || []).map((e) => ({
      nickname: nickOf.get(e.user_id) || "?",
      type: "lotto",
      at: e.created_at,
    })),
  ]
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 30);

  return json({ rankings, activity });
}
