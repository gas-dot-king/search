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
      hours: "오전 8시 ~ 오후 2시",
      venue: "실내 체육관",
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
});
