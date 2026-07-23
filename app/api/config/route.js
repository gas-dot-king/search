import { getSettings, publicConfig } from "@/lib/settings";
import { route } from "@/lib/api";

/** 공개 설정 (기간, 공지, 당첨번호 등) */
export const GET = route(async (req) =>
  Response.json(publicConfig(await getSettings()), {
    headers: {
      "Cache-Control": new URL(req.url).searchParams.get("fresh") === "1"
        ? "no-store"
        : "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
    },
  })
);
