export const MAX_EVENT_TIMELINE_ITEMS = 12;
export const MAX_EVENT_ACTIVITIES = 20;

export const DEFAULT_EVENT_GUIDE = {
  hours: "오전 7시 ~ 오후 1시",
  venue: "양주 체육문화센터",
  timeline: [
    { id: "running", time: "07:00 ~ 08:00", title: "간단한 러닝", activities: [] },
    { id: "breakfast", time: "08:00 ~ 09:00", title: "아침 식사", activities: [] },
    { id: "indoor", time: "09:00 ~ 13:00", title: "실내 레크레이션", activities: [] },
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
    hours: cleanText(guide.hours, 80) || DEFAULT_EVENT_GUIDE.hours,
    venue: cleanText(guide.venue, 120) || DEFAULT_EVENT_GUIDE.venue,
    timeline: timeline.length > 0 ? timeline : cloneDefaultGuide().timeline,
  };
}

// Settings에서 읽을 때 쓰기 좋은 이름을 함께 제공한다.
export const parseEventGuide = normalizeEventGuide;

export function serializeEventGuide(raw) {
  return JSON.stringify(normalizeEventGuide(raw));
}
