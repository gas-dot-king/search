import { describe, expect, it } from "vitest";
import { DAILY_GREETING_MESSAGES, todayGreetingMessage } from "../lib/greeting";

describe("daily greeting message", () => {
  it("returns a message from the published list", () => {
    expect(DAILY_GREETING_MESSAGES).toContain(todayGreetingMessage(new Date(2026, 7, 15, 9, 0)));
  });

  it("changes when the calendar date changes", () => {
    const day1 = todayGreetingMessage(new Date(2026, 7, 15, 23, 50));
    const day2 = todayGreetingMessage(new Date(2026, 7, 16, 0, 10));
    expect(day1).not.toBe(day2);
  });

  it("stays the same throughout the same calendar day", () => {
    const morning = todayGreetingMessage(new Date(2026, 7, 15, 0, 5));
    const night = todayGreetingMessage(new Date(2026, 7, 15, 23, 55));
    expect(morning).toBe(night);
  });
});
