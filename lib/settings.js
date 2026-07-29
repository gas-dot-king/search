import { sb } from "./db";
import { parseNotices } from "./notices";
import { parseEventGuide } from "./event";
import { LOTTO_ENTRY_LIMIT } from "./lotto";
import { demoSettings, isDemoMode } from "./demo";

export const EDITABLE_KEYS = [
  "upload_start",
  "upload_end",
  "draw_date",
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
  if (isDemoMode()) return demoSettings();
  if (cachedSettings && Date.now() - cachedAt < SETTINGS_CACHE_TTL_MS) return cachedSettings;
  const { data, error } = await sb().from("settings").select("key, value");
  // 오류를 무시하고 빈 설정을 캐시하면, 잠깐의 DB 장애가 5초 동안
  // "기간이 마감되었어요"(실제로는 기간 정보를 못 읽은 것)로 둔갑하고
  // 행사 안내도 기본값으로 조용히 바뀐다. 차라리 실패를 드러낸다.
  if (error) throw new Error(`설정을 불러오지 못했습니다: ${error.message}`);
  cachedSettings = Object.fromEntries((data || []).map((r) => [r.key, r.value]));
  cachedAt = Date.now();
  return cachedSettings;
}

/** 관리자가 설정을 수정한 직후 호출해, 다음 조회가 캐시된 옛 값을 안 보게 한다 */
export function invalidateSettingsCache() {
  cachedSettings = null;
}

// 기간 판정은 클라이언트 번들에서도 쓰이므로 lib/period.js에 있다.
export { inUploadPeriod, uploadPeriodState, uploadPeriodNotice, UPLOAD_PERIOD } from "./period";

/** 관리자 화면에 필요한 설정만 추린다 (redraw:* 같은 내부 키 제외) */
export function editableSettings(settings) {
  return Object.fromEntries(EDITABLE_KEYS.map((key) => [key, settings[key] ?? ""]));
}

/** 클라이언트에 공개해도 되는 설정만 추린다 */
export function publicConfig(settings) {
  return {
    uploadStart: settings.upload_start,
    uploadEnd: settings.upload_end,
    drawDate: settings.draw_date,
    maxLottoEntries: LOTTO_ENTRY_LIMIT,
    winningNumbers: settings.winning_numbers || "",
    notices: parseNotices(settings.notice),
    eventGuide: parseEventGuide(settings.event_guide),
  };
}
