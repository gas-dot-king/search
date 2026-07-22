import { userHasBoard } from "@/lib/db";
import { route, requireUser } from "@/lib/api";

/** 저장된 토큰으로 자동 로그인 */
export const GET = route(async (req) => {
  const user = await requireUser(req);
  return { nickname: user.nickname, hasBoard: await userHasBoard(user.id) };
});
