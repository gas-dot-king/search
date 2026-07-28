import { sb } from "./db";
import { parseNotices } from "./notices";
import { parseEventGuide } from "./event";

export const EDITABLE_KEYS = [
  "upload_start",
  "upload_end",
  "draw_date",
  "max_lotto_entries",
  "winning_numbers",
  "notice",
  "event_guide",
];

export async function getSettings() {
  const { data } = await sb().from("settings").select("key, value");
  return Object.fromEntries((data || []).map((r) => [r.key, r.value]));
}

export function inUploadPeriod(settings, now = new Date()) {
  const start = new Date(settings.upload_start);
  const end = new Date(settings.upload_end);
  return now >= start && now <= end;
}

/** 클라이언트에 공개해도 되는 설정만 추린다 */
export function publicConfig(settings) {
  return {
    uploadStart: settings.upload_start,
    uploadEnd: settings.upload_end,
    drawDate: settings.draw_date,
    maxLottoEntries: Number(settings.max_lotto_entries || 1),
    winningNumbers: settings.winning_numbers || "",
    notices: parseNotices(settings.notice),
    eventGuide: parseEventGuide(settings.event_guide),
  };
}
