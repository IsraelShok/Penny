import { describe, expect, it } from "vitest";
import { periodRange, previousPeriod, sameElapsed, samePeriodLastYear } from "@/lib/period";

const nov5 = new Date(2026, 10, 5);

describe("periodRange", () => {
  it("finds the calendar period holding today", () => {
    expect(periodRange("month", nov5)).toMatchObject({ from: "2026-11-01", to: "2026-11-30" });
    expect(periodRange("quarter", nov5)).toMatchObject({ from: "2026-10-01", to: "2026-12-31" });
    expect(periodRange("half", nov5)).toMatchObject({ from: "2026-07-01", to: "2026-12-31" });
    expect(periodRange("year", nov5).months).toHaveLength(12);
  });

  it("steps back across year boundaries", () => {
    expect(periodRange("quarter", nov5, 4)).toMatchObject({ from: "2025-10-01", to: "2025-12-31" });
    expect(periodRange("month", new Date(2026, 0, 10), 1)).toMatchObject({ from: "2025-12-01", to: "2025-12-31" });
    expect(periodRange("month", new Date(2024, 1, 3))).toMatchObject({ to: "2024-02-29" });
  });

  it("gives the previous and last-year periods", () => {
    const q1 = periodRange("quarter", new Date(2026, 1, 1));
    expect(previousPeriod(q1)).toMatchObject({ from: "2025-10-01", to: "2025-12-31" });
    expect(samePeriodLastYear(q1)).toMatchObject({ from: "2025-01-01", to: "2025-03-31" });
  });
});

describe("sameElapsed", () => {
  it("trims the comparison to the days already gone by", () => {
    const q4 = periodRange("quarter", nov5);
    expect(sameElapsed(previousPeriod(q4), q4, nov5)).toMatchObject({ from: "2026-07-01", to: "2026-08-05" });
    expect(sameElapsed(samePeriodLastYear(q4), q4, nov5).to).toBe("2025-11-05");
  });
});
