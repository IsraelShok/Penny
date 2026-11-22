import { describe, expect, it } from "vitest";
import { cashflowLevel, cashflowSigns } from "@/lib/cashflow-health";
import { holidaySuggestions } from "@/lib/holidays";

const ok = {
  overdraftMonths: 0,
  installmentShare: 0.05,
  newLoans: 0,
  lateFees: 0,
  liquid: 20000,
  deficitMonths: 0,
};

describe("cash-flow health", () => {
  it("is healthy with no signs", () => {
    expect(cashflowLevel(cashflowSigns(ok))).toBe("healthy");
  });
  it("is a problem from three signs", () => {
    const s = cashflowSigns({ ...ok, overdraftMonths: 3, installmentShare: 0.3, liquid: 400 });
    expect(s).toEqual(["overdraft", "installments", "noBuffer"]);
    expect(cashflowLevel(s)).toBe("problem");
  });
});

describe("holiday templates", () => {
  it("suggests the next holidays with at least two months to save", () => {
    const s = holidaySuggestions("2026-11-13", new Set());
    expect(s.map((x) => [x.autoKey, x.nextDue])).toEqual([
      ["holiday:pesach", "2027-04"],
      ["holiday:rosh-hashana", "2027-10"],
      ["holiday:august", "2027-08"],
    ]);
  });
  it("skips added or dismissed ones", () => {
    expect(
      holidaySuggestions("2026-11-13", new Set(["holiday:pesach"])).some(
        (x) => x.autoKey === "holiday:pesach",
      ),
    ).toBe(false);
  });
  it("picks this year's Pesach when it is far enough", () => {
    expect(holidaySuggestions("2027-01-05", new Set())[0].nextDue).toBe("2027-04");
  });
});
