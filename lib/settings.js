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

// 설정은 자주 안 바뀌는데 거의 모든 요청(로또·업로드기간 확인·공개 설정 등)에서
// 읽으므로, 짧게 캐시해 매 요청마다 DB 왕복하는 걸 줄인다.
const SETTINGS_CACHE_TTL_MS = 5_000;
let cachedSettings = null;
let cachedAt = 0;

export async function getSettings() {
  if (cachedSettings && Date.now() - cachedAt < SETTINGS_CACHE_TTL_MS) return cachedSettings;
  const { data } = await sb().from("settings").select("key, value");
  cachedSettings = Object.fromEntries((data || []).map((r) => [r.key, r.value]));
  cachedAt = Date.now();
  return cachedSettings;
}

/** 관리자가 설정을 수정한 직후 호출해, 다음 조회가 캐시된 옛 값을 안 보게 한다 */
export function invalidateSettingsCache() {
  cachedSettings = null;
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
