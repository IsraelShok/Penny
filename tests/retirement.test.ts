import { describe, expect, it } from "vitest";
import { annuityVsLump, coverCheck, severanceChoice, suggestTracks } from "@/lib/retirement";
import { coastCheck, fiBridge, yearsBySavingsRate } from "@/lib/fi";

describe("annuityVsLump", () => {
  it("annuity is balance over the factor, break-even after factor months", () => {
    const r = annuityVsLump({ balance: 1_200_000, factor: 200, age: 67, untilAge: 87, returnPct: 0, lumpTaxPct: 0 });
    expect(r.annuity).toBe(6000);
    expect(r.breakEvenAge).toBeCloseTo(67 + 200 / 12);
    expect(r.lumpMonthly).toBeCloseTo(1_200_000 / 240);
  });
  it("tax lowers the lump and a return raises its drawdown", () => {
    const a = annuityVsLump({ balance: 1_000_000, factor: 200, age: 67, untilAge: 87, returnPct: 4, lumpTaxPct: 10 });
    expect(a.lumpNet).toBe(900_000);
    expect(a.lumpMonthly).toBeGreaterThan(900_000 / 240);
  });
});

describe("severanceChoice", () => {
  it("exempts up to the per-year ceiling and taxes the rest", () => {
    const r = severanceChoice({ amount: 200_000, serviceYears: 10, salary: 20_000, yearsToRetire: 0, returnPct: 5, taxPct: 35, exemptPerYear: 13_750 });
    expect(r.exempt).toBe(137_500);
    expect(r.taxNow).toBeCloseTo(62_500 * 0.35);
    expect(r.lost).toBeCloseTo(r.taxNow);
  });
  it("caps the exemption at 1.5 salaries a year, and keeping beats withdrawing over time", () => {
    const r = severanceChoice({ amount: 50_000, serviceYears: 2, salary: 8_000, yearsToRetire: 25, returnPct: 5, taxPct: 20, exemptPerYear: 13_750 });
    expect(r.exempt).toBe(24_000);
    expect(r.keep).toBeGreaterThan(r.withdrawInvested);
  });
});

describe("suggestTracks", () => {
  it("long horizon and high risk leads with the index track", () => {
    expect(suggestTracks({ age: 30, horizonYears: 37, risk: "high", balance: 50_000 })[0]).toBe("sp500");
  });
  it("short horizon leans to bonds and general", () => {
    expect(suggestTracks({ age: 64, horizonYears: 2, risk: "mid", balance: 50_000 })).toEqual(["bonds", "general"]);
  });
  it("adds self-managed only for larger balances", () => {
    expect(suggestTracks({ age: 40, horizonYears: 25, risk: "mid", balance: 300_000 })).toContain("selfManaged");
    expect(suggestTracks({ age: 40, horizonYears: 25, risk: "mid", balance: 30_000 })).not.toContain("selfManaged");
  });
});

describe("coverCheck", () => {
  it("flags low disability cover and missing survivors cover", () => {
    expect(coverCheck({ disabilityPct: 60, hasDependents: true, survivorsCovered: false })).toEqual(["disabilityLow", "survivorsMissing"]);
    expect(coverCheck({ disabilityPct: 75, hasDependents: false, survivorsCovered: true })).toEqual(["disabilityOk", "survivorsMaybeWaive"]);
  });
});

describe("FI bridge", () => {
  it("counts the gap years and adds them on top of the post-pension number", () => {
    const b = fiBridge({ fiAge: 52, pensionAge: 67, monthlySpend: 10_000, monthlyPension: 6_000, withdrawalRate: 0.04, realReturn: 0 });
    expect(b.gapYears).toBe(15);
    expect(b.bridge).toBe(10_000 * 180);
    expect(b.after).toBe(1_200_000);
    expect(b.total).toBe(1_800_000 + 1_200_000);
  });
  it("has no gap when retiring at pension age", () => {
    expect(fiBridge({ fiAge: 70, pensionAge: 67, monthlySpend: 10_000, monthlyPension: 0, withdrawalRate: 0.04, realReturn: 0.03 }).bridge).toBe(0);
  });
  it("coast check and the savings-rate table", () => {
    expect(coastCheck(100_000, 0.05, 30, 400_000).canStop).toBe(true);
    expect(coastCheck(100_000, 0.05, 10, 400_000).canStop).toBe(false);
    const t = yearsBySavingsRate(10_000, 0, 0.05, 0.04);
    expect(t[5].years!).toBeLessThan(t[0].years!);
  });
});
