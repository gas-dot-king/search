import { getSettings, publicConfig } from "@/lib/settings";
import { json } from "@/lib/auth";

/** 공개 설정 (기간, 공지, 당첨번호 등) */
export async function GET() {
  const settings = await getSettings();
  return json(publicConfig(settings));
}
