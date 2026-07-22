import { route, requireUser } from "@/lib/api";
import { getAllProgress } from "@/lib/progress";

/** 동호회 현황: 진행률 랭킹 + 최근 활동 (사진은 비공개) */
export const GET = route(async (req) => {
  await requireUser(req);
  const { progress, users, cells, lotto } = await getAllProgress();

  const nickOf = new Map(users.map((u) => [u.id, u.nickname]));

  const rankings = progress
    .map(({ nickname, filled, lines, lottoEntries }) => ({ nickname, filled, lines, lottoEntries }))
    .sort((a, b) => b.lines - a.lines || b.filled - a.filled || a.nickname.localeCompare(b.nickname));

  const activity = [
    ...cells
      .filter((c) => c.uploaded_at)
      .map((c) => ({ nickname: nickOf.get(c.user_id) || "?", type: "bingo", at: c.uploaded_at })),
    ...lotto.map((e) => ({ nickname: nickOf.get(e.user_id) || "?", type: "lotto", at: e.created_at })),
  ]
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 30);

  return { rankings, activity };
});
