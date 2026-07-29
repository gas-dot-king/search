export const MAX_EVENT_TIMELINE_ITEMS = 12;
export const MAX_EVENT_ACTIVITIES = 20;
export const DEFAULT_EVENT_DATE = "2026-08-15";
export const DEFAULT_EVENT_VENUE = "양주 문화체육센터";

const LEGACY_EVENT_VENUES = new Set([
  "양산 문화체육센터 1층 실내체육관",
  "양주 체육문화센터",
]);

export const DEFAULT_EVENT_GUIDE = {
  date: DEFAULT_EVENT_DATE,
  hours: "오전 9시 ~ 오후 1시",
  venue: DEFAULT_EVENT_VENUE,
  parkingInfo: "건물 하부 공터에 주차 가능합니다. 자세한 위치는 사진으로 추후 안내할게요.",
  mapUrl: "https://naver.me/59vQDKHt",
  // 관리자 화면에서 입력하기 전까지는 지도를 숨기고 지도 링크만 노출한다.
  lat: null,
  lng: null,
  timeline: [
    {
      id: "freerun",
      time: "05:00 ~ 06:00",
      title: "8.15 러닝 (프리런)",
      activities: [
        "장소: 양주 문화체육센터",
        "8.15km 인증 도전 · 자신이 뛸 수 있는 만큼 자유 참여",
      ],
    },
    { id: "kickoff", time: "08:30", title: "공식 일정 시작", activities: [] },
    { id: "indoor", time: "09:00 ~ 12:30", title: "실내 레크레이션", activities: [] },
    { id: "wrapup", time: "12:30 ~ 13:00", title: "마무리 정리", activities: [] },
  ],
};

function cloneDefaultGuide() {
  return {
    ...DEFAULT_EVENT_GUIDE,
    timeline: DEFAULT_EVENT_GUIDE.timeline.map((item) => ({ ...item, activities: [...item.activities] })),
  };
}

function cleanText(value, maxLength) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function cleanVenue(value) {
  const venue = cleanText(value, 120);
  return !venue || LEGACY_EVENT_VENUES.has(venue) ? DEFAULT_EVENT_VENUE : venue;
}

function cleanDate(value) {
  const text = cleanText(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : DEFAULT_EVENT_GUIDE.date;
}

// href로 그대로 쓰이므로 javascript: 등 위험한 스킴을 막기 위해 https만 허용한다.
function cleanMapUrl(value) {
  const text = cleanText(value, 300);
  return /^https:\/\//i.test(text) ? text : DEFAULT_EVENT_GUIDE.mapUrl;
}

// 지도 마커 좌표. 오타로 엉뚱한 위치를 안내하지 않도록 한반도 범위를 벗어나면 버린다.
function cleanCoordinate(value, min, max) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

// 위도·경도는 한쪽만으로는 지도를 그릴 수 없으므로 둘 다 유효할 때만 좌표로 인정한다.
function cleanCoordinates(guide) {
  const lat = cleanCoordinate(guide.lat, 33, 39);
  const lng = cleanCoordinate(guide.lng, 124, 132);
  return lat === null || lng === null ? { lat: null, lng: null } : { lat, lng };
}

function readGuide(raw) {
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : null;
}

/**
 * 행사 안내 설정을 안전한 표시/저장 형태로 정규화한다.
 * 기존 설정이 없거나 형식이 깨진 경우에는 기본 일정을 보여 준다.
 */
export function normalizeEventGuide(raw) {
  const guide = readGuide(raw);
  if (!guide) return cloneDefaultGuide();

  const timeline = Array.isArray(guide.timeline)
    ? guide.timeline
        .slice(0, MAX_EVENT_TIMELINE_ITEMS)
        .map((item, index) => {
          const source = item && typeof item === "object" ? item : {};
          const activities = Array.isArray(source.activities)
            ? source.activities
                .map((activity) => cleanText(activity, 120))
                .filter(Boolean)
                .slice(0, MAX_EVENT_ACTIVITIES)
            : [];

          return {
            id: cleanText(source.id, 64) || `timeline-${index + 1}`,
            time: cleanText(source.time, 80),
            title: cleanText(source.title, 120),
            activities,
          };
        })
        .filter((item) => item.time || item.title || item.activities.length > 0)
    : [];

  return {
    date: cleanDate(guide.date),
    hours: cleanText(guide.hours, 80) || DEFAULT_EVENT_GUIDE.hours,
    venue: cleanVenue(guide.venue),
    parkingInfo: cleanText(guide.parkingInfo, 300) || DEFAULT_EVENT_GUIDE.parkingInfo,
    mapUrl: cleanMapUrl(guide.mapUrl),
    ...cleanCoordinates(guide),
    timeline: timeline.length > 0 ? timeline : cloneDefaultGuide().timeline,
  };
}

// Settings에서 읽을 때 쓰기 좋은 이름을 함께 제공한다.
export const parseEventGuide = normalizeEventGuide;

export function serializeEventGuide(raw) {
  return JSON.stringify(normalizeEventGuide(raw));
}
