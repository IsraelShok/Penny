import { describe, expect, it } from "vitest";
import { EMPTY_HOUSEHOLD, isGentle, parseHousehold, shouldSuggestGentle } from "@/lib/household";

describe("parseHousehold", () => {
  it("fills defaults from empty input", () => {
    expect(parseHousehold(null)).toEqual(EMPTY_HOUSEHOLD);
  });
  it("rejects bad roles, dates and amounts", () => {
    expect(() => parseHousehold({ members: [{ id: "a", name: "x", role: "boss" }] })).toThrow();
    expect(() => parseHousehold({ events: [{ id: "a", type: "birth", date: "soon" }] })).toThrow();
  });
  it("suggests gentle mode once after a hard event", () => {
    const h = parseHousehold({ events: [{ id: "a", type: "divorce", date: "2026-01-01" }] });
    expect(shouldSuggestGentle(h)).toBe(true);
    expect(shouldSuggestGentle({ ...h, gentleSuggestionDismissed: true })).toBe(false);
    expect(shouldSuggestGentle({ ...h, gentleMode: true })).toBe(false);
  });
});

describe("isGentle", () => {
  const today = new Date("2026-11-06");
  const ev = (type: "loss" | "wedding", date: string) => ({ ...EMPTY_HOUSEHOLD, events: [{ id: "a", type, date }] });
  it("follows gentleMode or a recent hard event", () => {
    expect(isGentle({ ...EMPTY_HOUSEHOLD, gentleMode: true }, today)).toBe(true);
    expect(isGentle(ev("loss", "2026-06-01"), today)).toBe(true);
    expect(isGentle(ev("loss", ""), today)).toBe(true);
    expect(isGentle(ev("loss", "2016-01-01"), today)).toBe(false);
    expect(isGentle(ev("wedding", "2026-10-01"), today)).toBe(false);
  });
});
