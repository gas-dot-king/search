import { describe, expect, it } from "vitest";
import { DEFAULT_EVENT_GUIDE, normalizeEventGuide, serializeEventGuide } from "../lib/event";

describe("event guide settings", () => {
  it("uses the published schedule when no valid guide is stored", () => {
    expect(normalizeEventGuide("")).toEqual(DEFAULT_EVENT_GUIDE);
    expect(normalizeEventGuide("not-json")).toEqual(DEFAULT_EVENT_GUIDE);
  });

  it("keeps editable timeline activities and removes blank values", () => {
    const guide = normalizeEventGuide({
      hours: "  오전 8시 ~ 오후 2시  ",
      venue: "  실내 체육관 ",
      timeline: [
        {
          id: "games",
          time: "10:00 ~ 12:00",
          title: "레크리에이션",
          activities: ["팀 대항 게임", "  ", 123],
        },
      ],
    });

    expect(guide).toEqual({
      date: DEFAULT_EVENT_GUIDE.date,
      hours: "오전 8시 ~ 오후 2시",
      venue: "실내 체육관",
      parkingInfo: DEFAULT_EVENT_GUIDE.parkingInfo,
      mapUrl: DEFAULT_EVENT_GUIDE.mapUrl,
      lat: null,
      lng: null,
      timeline: [
        {
          id: "games",
          time: "10:00 ~ 12:00",
          title: "레크리에이션",
          activities: ["팀 대항 게임", "123"],
        },
      ],
    });
    expect(JSON.parse(serializeEventGuide(guide))).toEqual(guide);
  });

  it("rejects an invalid date and a non-https map link", () => {
    const guide = normalizeEventGuide({
      date: "not-a-date",
      mapUrl: "javascript:alert(1)",
    });

    expect(guide.date).toBe(DEFAULT_EVENT_GUIDE.date);
    expect(guide.mapUrl).toBe(DEFAULT_EVENT_GUIDE.mapUrl);
  });

  it("accepts a valid date and https map link", () => {
    const guide = normalizeEventGuide({
      date: "2026-09-01",
      mapUrl: "https://naver.me/example",
    });

    expect(guide.date).toBe("2026-09-01");
    expect(guide.mapUrl).toBe("https://naver.me/example");
  });

  it("replaces legacy event venue names with the published venue", () => {
    for (const venue of ["양산 문화체육센터 1층 실내체육관", "양주 체육문화센터"]) {
      expect(normalizeEventGuide({ venue }).venue).toBe("양주 문화체육센터");
    }
  });

  it("keeps map coordinates inside Korea and drops anything else", () => {
    const inside = normalizeEventGuide({ lat: "35.335", lng: 129.0356 });
    expect(inside.lat).toBe(35.335);
    expect(inside.lng).toBe(129.0356);

    // 빈 값·오타·다른 나라 좌표는 지도를 숨기도록 null로 떨어뜨린다.
    for (const bad of [{}, { lat: "", lng: "" }, { lat: "abc", lng: "129" }, { lat: 48.85, lng: 2.35 }]) {
      const guide = normalizeEventGuide(bad);
      expect(guide.lat).toBeNull();
      expect(guide.lng).toBeNull();
    }
  });
});
