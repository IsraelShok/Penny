import { describe, expect, it } from "vitest";
import { todayState } from "@/lib/today-state";

const ready = {
  pending: false, failed: false, hasCash: true, balance: 100,
  connected: true, checkedThisWeek: true, needsReview: false, hasSuggestions: false,
};

describe("today: trustworthy next action", () => {
  it("does not show a bank setup prompt while data loads", () => {
    expect(todayState({ ...ready, pending: true, hasCash: false, balance: null, connected: false })).toBe("loading");
  });
  it("never reassures when a required request failed, even with cached data", () => {
    expect(todayState({ ...ready, failed: true })).toBe("error");
    expect(todayState({ ...ready, failed: true, pending: true })).toBe("error");
  });
  it("distinguishes no connection from a connected bank without a balance", () => {
    expect(todayState({ ...ready, balance: null, connected: false })).toBe("connect");
    expect(todayState({ ...ready, balance: null })).toBe("sync");
  });
  it("waits for missing cash data rather than showing all done", () => {
    expect(todayState({ ...ready, hasCash: false })).toBe("loading");
  });
  it("offers one action in priority order", () => {
    expect(todayState({ ...ready, checkedThisWeek: false, needsReview: true, hasSuggestions: true })).toBe("checkin");
    expect(todayState({ ...ready, needsReview: true, hasSuggestions: true })).toBe("review");
    expect(todayState({ ...ready, hasSuggestions: true })).toBe("suggestions");
    expect(todayState(ready)).toBe("done");
  });
  it("prioritizes a projected shortfall over a routine check-in or all done", () => {
    expect(todayState({ ...ready, balance: -100 })).toBe("cash");
    expect(todayState({ ...ready, balance: -100, checkedThisWeek: false })).toBe("cash");
  });
  it("accepts a zero balance as data, not a missing account", () => {
    expect(todayState({ ...ready, balance: 0 })).toBe("done");
  });
});
