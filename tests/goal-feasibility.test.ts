import { describe, expect, it } from "vitest";
import { goalsFit, monthsBetween } from "@/lib/goal-feasibility";

const today = new Date(2026, 0, 15); // Jan 2026

describe("monthsBetween", () => {
  it("counts across a year boundary", () => {
    expect(monthsBetween("2025-12", "2026-02")).toBe(2);
    expect(monthsBetween("2026-03", "2026-01")).toBe(-2);
  });
});

describe("goalsFit", () => {
  const car = { id: 1, targetAmount: 12000, savedAmount: 0, targetDate: "2027-01" }; // needs 1000/mo
  const trip = { id: 2, targetAmount: 6000, savedAmount: 0, targetDate: "2026-07" }; // needs 1000/mo

  it("everything fits: no slip", () => {
    const r = goalsFit([car, trip], 2000, today);
    expect(r.map((g) => [g.id, g.slipMonths])).toEqual([
      [2, 0],
      [1, 0],
    ]);
  });

  it("earliest date is funded first; the later one slips", () => {
    const [first, second] = goalsFit([car, trip], 1500, today);
    expect(first).toMatchObject({ id: 2, allocated: 1000, slipMonths: 0 });
    // 12000 at 500/mo = 24 months from Jan 2026 = Jan 2028, a year late.
    expect(second).toMatchObject({ id: 1, allocated: 500, reach: "2028-01", slipMonths: 12 });
  });

  it("nothing left: never reached", () => {
    const [, second] = goalsFit([car, trip], 1000, today);
    expect(second).toMatchObject({ reach: null, slipMonths: null });
  });

  it("negative saving counts as zero", () => {
    expect(goalsFit([trip], -500, today)[0].slipMonths).toBeNull();
  });

  it("skips reached and undated goals", () => {
    const done = { id: 3, targetAmount: 100, savedAmount: 100, targetDate: "2026-05" };
    const undated = { ...car, id: 4, dated: false };
    expect(goalsFit([done, undated], 5000, today)).toEqual([]);
  });

  it("a passed date paid in full lands after one month of saving (same rule as goalReachMonth)", () => {
    const late = { id: 5, targetAmount: 1000, savedAmount: 0, targetDate: "2025-10" };
    expect(goalsFit([late], 1000, today)[0]).toMatchObject({ reach: "2026-02", slipMonths: 4 });
  });
});
