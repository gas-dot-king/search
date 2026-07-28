import { sb } from "@/lib/db";
import { route, requireUser } from "@/lib/api";
import { demoItems, isDemoMode } from "@/lib/demo";

/** 전체 빙고 항목 (회원 열람용) */
export const GET = route(async (req) => {
  await requireUser(req);
  if (isDemoMode()) return { items: demoItems() };
  const { data } = await sb()
    .from("bingo_items")
    .select("id, category, content")
    .order("category")
    .order("id");
  return { items: data || [] };
});
