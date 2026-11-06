import { describe, expect, it } from "vitest";
import { EMPTY_HOUSEHOLD, parseHousehold, shouldSuggestGentle } from "@/lib/household";

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
