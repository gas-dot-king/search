import { sb } from "@/lib/db";
import { route, requireUser, ApiError } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { getBingoHallOfFame } from "@/lib/progress";
import { computeWinners, LOTTO_DRAW_DIGITS } from "@/lib/lotto";
import { demoHall, isDemoMode } from "@/lib/demo";

/**
 * 명예의 전당에서 사람마다 달라지지 않는 집계 부분.
 * 후원자·챌린지 수상자 명단은 lib/hall.js에 고정돼 있어 화면에서 바로 읽는다.
 */
export const GET = route(async (req) => {
  await requireUser(req);
  if (isDemoMode()) return demoHall();

  // 빙고 집계는 한 시간에 한 번만 계산하고, 당첨 번호는 추첨 중 바로 보여야 하므로 매번 읽는다.
  const [settings, bingo] = await Promise.all([getSettings(), getBingoHallOfFame()]);

  const winningNumbers = settings.winning_numbers || "";
  // 세 자리가 다 나오기 전에는 당첨자를 계산할 수 없으므로 응모 전체를 읽지도 않는다.
  let winners = null;
  if (winningNumbers.length === LOTTO_DRAW_DIGITS) {
    const { data: entries, error } = await sb()
      .from("lotto_entries")
      .select("digits, users ( nickname )")
      .not("slot", "is", null);
    if (error) throw new ApiError("추첨 결과를 계산하지 못했습니다.", 500);
    winners = computeWinners(entries, winningNumbers);
  }

  return {
    lotto: { winningNumbers, drawDate: settings.draw_date || "", winners },
    bingo,
  };
});
