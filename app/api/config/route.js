import { getSettings, publicConfig } from "@/lib/settings";
import { route } from "@/lib/api";

/** 공개 설정 (기간, 공지, 당첨번호 등) */
export const GET = route(async () => publicConfig(await getSettings()));
