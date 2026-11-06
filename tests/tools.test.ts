import { describe, expect, it } from "vitest";
import { brokerOutcome, fundSwitch, gemelVsBroker } from "@/lib/tools";
import { fiOdds, yearsToTarget, yearsToTargetWithEvents } from "@/lib/fi";
import { parsePlan } from "@/lib/plan";

describe("fundSwitch", () => {
  it("lower fees end higher; equal fees end equal", () => {
    const r = fundSwitch(200_000, 2_000, 20, 0.05, { depositPct: 1, balancePct: 0.8 }, { depositPct: 0, balancePct: 0.3 });
    expect(r.diff).toBeGreaterThan(50_000);
    expect(fundSwitch(1, 1, 1, 0.05, { depositPct: 1, balancePct: 1 }, { depositPct: 1, balancePct: 1 }).diff).toBe(0);
  });
});

describe("gemelVsBroker", () => {
  const base = { initial: 0, monthly: 1_000, years: 20, grossReturn: 0.06, inflation: 0.02, gemelFeePct: 0.65, etfFeePct: 0.1, custodyMonthly: 0 };
  it("annuity is untaxed, lump sum pays 25% of nominal gains", () => {
    const r = gemelVsBroker(base);
    expect(r.deposited).toBe(240_000);
    expect(r.gemelLump).toBeCloseTo(r.gemelAnnuity - 0.25 * (r.gemelAnnuity - 240_000), 6);
    expect(r.broker).toBeGreaterThan(r.gemelLump); // lower fees and tax on real gains only
  });
  it("no gains, no tax", () => {
    const r = gemelVsBroker({ ...base, grossReturn: 0, inflation: 0, gemelFeePct: 0, etfFeePct: 0 });
    expect(r.broker).toBeCloseTo(240_000, 6);
    expect(r.gemelLump).toBeCloseTo(240_000, 6);
  });
});

describe("brokerOutcome", () => {
  it("sums fees and the cheaper broker ends higher", () => {
    const a = brokerOutcome({ perTrade: 5, pct: 0, custodyMonthly: 0 }, 1_000, 1, 10, 0);
    expect(a.fees).toBe(600);
    expect(a.value).toBe(120_000 - 600);
    const b = brokerOutcome({ perTrade: 0, pct: 0.1, custodyMonthly: 15 }, 1_000, 1, 10, 0.05);
    expect(b.fees).toBe(120 * 16);
  });
});

describe("FI with events and Monte Carlo", () => {
  it("matches the plain projection without events", () => {
    expect(yearsToTargetWithEvents(100_000, 5_000, 0.05, 1_000_000, [], 2026)).toBeCloseTo(yearsToTarget(100_000, 5_000, 0.05, 1_000_000)!, 6);
  });
  it("a cost pushes FI later, a mortgage end brings it closer", () => {
    const plain = yearsToTargetWithEvents(100_000, 5_000, 0.05, 1_000_000, [], 2026)!;
    expect(yearsToTargetWithEvents(100_000, 5_000, 0.05, 1_000_000, [{ year: 2028, amount: -300_000, monthlyChange: 0 }], 2026)!).toBeGreaterThan(plain);
    expect(yearsToTargetWithEvents(100_000, 5_000, 0.05, 1_000_000, [{ year: 2027, amount: 0, monthlyChange: -3_000 }], 2026)!).toBeLessThan(plain);
  });
  it("is deterministic and sensible", () => {
    const a = fiOdds(100_000, 5_000, 0.05, 1_000_000, 10, [], 2026);
    expect(fiOdds(100_000, 5_000, 0.05, 1_000_000, 10, [], 2026)).toEqual(a);
    expect(a.p10! <= a.p50! && a.p50! <= a.p90!).toBe(true);
    expect(fiOdds(100_000, 5_000, 0.05, 1_000_000, 60, [], 2026).probability).toBeGreaterThan(0.95);
    expect(fiOdds(0, 0, 0.05, 1_000_000, 30, [], 2026).probability).toBe(0);
  });
});

describe("plan events", () => {
  it("validates and caps at 12", () => {
    const p = parsePlan({ events: [{ name: "ילד", year: 2028, amount: "-5000", monthlyChange: 2000 }, null, "x", ...Array(20).fill({ year: 2030 })] });
    expect(p.events[0]).toEqual({ name: "ילד", year: 2028, amount: -5000, monthlyChange: 2000 });
    expect(p.events).toHaveLength(12);
    expect(parsePlan({}).events).toEqual([]);
    expect(parsePlan({ events: [{ year: "abc", amount: "x" }] }).events[0].amount).toBe(0);
  });
});
