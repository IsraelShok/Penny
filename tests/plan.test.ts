import { describe, expect, it } from "vitest";
import { completeCheckin, debtPayoff, defaultHomeStyle, feeCost, goalMonthly, isoWeek, keepHomeStyle, parsePlan, projectBalance } from "@/lib/plan";

describe("fees", () => {
  it("grows a balance without fees at the gross return", () => {
    expect(projectBalance(100_000, 0, 10, 0.05, 0, 0)).toBeCloseTo(100_000 * 1.05 ** 10, -1);
  });

  it("costs money when fees are above the benchmark, nothing when below", () => {
    const high = feeCost("pension", 300_000, 3_000, 30, 3, 0.5)!;
    expect(high.cost).toBeGreaterThan(100_000);
    expect(feeCost("pension", 300_000, 3_000, 30, 0.5, 0.1)!.cost).toBe(0);
    expect(feeCost("stock", 1, 1, 1, 1, 1)).toBeNull();
  });
});

describe("debtPayoff", () => {
  it("pays a 0% loan in balance / payment months", () => {
    expect(debtPayoff(12_000, 0, 1_000)).toEqual({ months: 12, interest: 0 });
  });

  it("charges interest and flags payments that never clear it", () => {
    const r = debtPayoff(100_000, 6, 2_000)!;
    expect(r.months).toBeGreaterThan(55);
    expect(r.interest).toBeGreaterThan(10_000);
    expect(debtPayoff(100_000, 12, 1_000)).toBeNull();
  });
});

describe("goalMonthly", () => {
  it("spreads the gap over the months left", () => {
    expect(goalMonthly(120_000, 0, "2027-11", new Date(2026, 10, 5))).toBe(10_000);
    expect(goalMonthly(100, 200, "2027-01", new Date(2026, 10, 5))).toBe(0);
  });
});

describe("parsePlan", () => {
  it("keeps good values and drops bad ones", () => {
    const p = parsePlan({ monthStartDay: 10, birthYear: "1988", emergencyMonths: 99, allocation: { equity: 80 }, taxDone: { study_fund: 2026, "<bad>": 1 } });
    expect(p).toMatchObject({ monthStartDay: 10, birthYear: 1988, emergencyMonths: 6, taxDone: { study_fund: 2026 } });
    expect(p.allocation).toEqual({ equity: 80, bonds: 20, cash: 10 });
  });
});

describe("weekly check-in", () => {
  it("names ISO weeks", () => {
    expect(isoWeek(new Date(2026, 10, 5))).toBe("2026-W45");
    expect(isoWeek(new Date(2027, 0, 1))).toBe("2026-W53");
  });

  it("grows the streak only for consecutive weeks", () => {
    const today = new Date(2026, 10, 5);
    expect(completeCheckin({ lastWeek: "2026-W44", streak: 3 }, today)).toEqual({ lastWeek: "2026-W45", streak: 4 });
    expect(completeCheckin({ lastWeek: "2026-W40", streak: 3 }, today)).toEqual({ lastWeek: "2026-W45", streak: 1 });
    expect(completeCheckin({ lastWeek: "2026-W45", streak: 4 }, today)).toEqual({ lastWeek: "2026-W45", streak: 4 });
  });

  it("defaults wheel paging and simple mode off", () => {
    expect(parsePlan({})).toMatchObject({ simpleMode: false, wheelPaging: false, checkin: { lastWeek: null, streak: 0 } });
  });
});

describe("homeStyle", () => {
  it("parses a valid style and falls back to companion", () => {
    expect(parsePlan({ homeStyle: "classic" }).homeStyle).toBe("classic");
    expect(parsePlan({ homeStyle: "x" }).homeStyle).toBe("companion");
  });
  it("defaults existing users to classic, new ones to companion", () => {
    expect(defaultHomeStyle(true, false)).toBe("classic");
    expect(defaultHomeStyle(false, true)).toBe("classic");
    expect(defaultHomeStyle(false, false)).toBe("companion");
  });
});

describe("keepHomeStyle", () => {
  it("keeps the stored style unless the client sends a valid one", () => {
    expect(keepHomeStyle({}, "classic")).toBe("classic");
    expect(keepHomeStyle({ homeStyle: "x" }, "classic")).toBe("classic");
    expect(keepHomeStyle(null, "classic")).toBe("classic");
    expect(keepHomeStyle({ homeStyle: "companion" }, "classic")).toBe("companion");
  });
});
