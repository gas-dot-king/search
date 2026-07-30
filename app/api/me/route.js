import { userBoardStatus } from "@/lib/db";
import { route, requireUser } from "@/lib/api";
import { maskedClientIp } from "@/lib/ip";

/** 저장된 토큰으로 자동 로그인 */
export const GET = route(async (req) => {
  const user = await requireUser(req);
  const board = await userBoardStatus(user.id);
  return { nickname: user.nickname, createdAt: user.createdAt, lastLoginIp: user.lastLoginIp, currentIp: maskedClientIp(req), ...board };
});
