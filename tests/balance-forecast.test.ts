import { describe, expect, it } from "vitest";
import { chargesBetween, forecastBalance } from "@/lib/balance-forecast";

describe("forecastBalance", () => {
  const base = { today: "2026-11-05", payday: 10, monthlyIncome: 10_000, days: 90 };

  it("adds salary, subtracts bills and recurring debits, finds the low point", () => {
    const f = forecastBalance({
      ...base,
      bank: 3_000,
      bills: [{ date: "2026-11-08", total: 2_500 }, { date: "2026-12-08", total: 9_000 }],
      recurring: [{ cadence: "monthly", lastDate: "2026-10-01", amount: 1_000 }],
    });
    expect(f.points).toHaveLength(91);
    expect(f.points[0]).toEqual({ date: "2026-11-05", balance: 3_000 });
    const at = (d: string) => f.points.find((p) => p.date === d)!.balance;
    expect(at("2026-11-08")).toBe(500);
    expect(at("2026-11-10")).toBe(10_500);
    expect(at("2026-12-01")).toBe(9_500);
    expect(at("2026-12-08")).toBe(500);
    expect(f.low).toEqual({ date: "2026-11-08", balance: 500 });
    expect(f.firstNegative).toBeNull();
    expect(f.nextPayday).toBe("2026-11-10");
  });

  it("reports the first day below zero", () => {
    const f = forecastBalance({ ...base, monthlyIncome: 0, bank: 100, bills: [{ date: "2026-11-20", total: 300 }], recurring: [] });
    expect(f.firstNegative).toBe("2026-11-20");
    expect(f.low.balance).toBe(-200);
    expect(f.nextPayday).toBeNull();
  });

  it("clamps monthly dates to short months", () => {
    expect(chargesBetween("monthly", "2026-01-31", "2026-02-01", "2026-04-30")).toEqual(["2026-02-28", "2026-03-31", "2026-04-30"]);
    expect(chargesBetween("weekly", "2026-11-01", "2026-11-02", "2026-11-15")).toEqual(["2026-11-08", "2026-11-15"]);
  });
});
