import { route, requireUser } from "@/lib/api";
import { getAllProgress } from "@/lib/progress";
import { LINES } from "@/lib/bingo";
import { demoProgress, isDemoMode } from "@/lib/demo";

function bingoLineActivities(cells, nickOf) {
  const cellsByUser = new Map();
  for (const cell of cells) {
    if (!cell.uploaded_at) continue;
    if (!cellsByUser.has(cell.user_id)) cellsByUser.set(cell.user_id, []);
    cellsByUser.get(cell.user_id).push(cell);
  }

  const events = new Map();
  for (const [userId, userCells] of cellsByUser) {
    const cellByPosition = new Map(userCells.map((cell) => [cell.position, cell]));
    for (const line of LINES) {
      const completedCells = line.map((position) => cellByPosition.get(position));
      if (completedCells.some((cell) => !cell)) continue;
      const at = completedCells.reduce((latest, cell) =>
        new Date(cell.uploaded_at) > new Date(latest) ? cell.uploaded_at : latest,
      completedCells[0].uploaded_at);
      const key = `${userId}:${at}`;
      const event = events.get(key) || {
        nickname: nickOf.get(userId) || "?",
        type: "bingo_line",
        at,
        lines: 0,
      };
      event.lines += 1;
      events.set(key, event);
    }
  }
  return [...events.values()];
}

/** 동호회 현황: 진행률 랭킹 + 최근 활동 (사진은 비공개) */
export const GET = route(async (req) => {
  const user = await requireUser(req);
  if (isDemoMode()) {
    const { progress, activity } = demoProgress();
    const rankings = progress
      .map(({ nickname, filled, lines, lottoEntries }) => ({ nickname, filled, lines, lottoEntries }))
      .sort((a, b) => b.lines - a.lines || b.filled - a.filled || a.nickname.localeCompare(b.nickname));
    return { rankings, activity };
  }
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
    ...bingoLineActivities(cells, nickOf),
  ]
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 30);

  return { rankings, activity };
});
