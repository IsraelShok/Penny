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

import { amendment190, bracketTax, rentVsBuy, spitzer } from "@/lib/tools";
import { IL } from "@/lib/il-defaults";
import { parseWellbeingHistory, wellbeingDue, wellbeingScore } from "@/lib/wellbeing";

describe("purchase tax and spitzer", () => {
  it("single-home brackets: exempt to 1.98M, ₪3M ≈ ₪45.5K", () => {
    expect(bracketTax(1_900_000, IL.purchaseTaxSingleHome)).toBe(0);
    expect(Math.round(bracketTax(3_000_000, IL.purchaseTaxSingleHome))).toBe(45_538);
  });
  it("spitzer payment for 1M, 5%, 25y ≈ ₪5,846", () => {
    expect(Math.round(spitzer(1_000_000, 0.05, 25))).toBe(5_846);
    expect(spitzer(120_000, 0, 10)).toBe(1_000);
  });
});

describe("rentVsBuy", () => {
  const base = { price: 2_500_000, down: 750_000, mortgageRate: 0.045, mortgageYears: 25, purchaseTax: 7_000, oneOffs: 60_000, ownerMonthly: 500, appreciation: 0.03, rent: 7_000, rentGrowth: 0.03, investReturn: 0.05, years: 15 };
  it("returns one row per year and a consistent diff", () => {
    const r = rentVsBuy(base);
    expect(r.yearly).toHaveLength(15);
    expect(r.diff).toBeCloseTo(r.buy - r.rent);
  });
  it("cheap rent with high returns favours renting; strong appreciation favours buying", () => {
    expect(rentVsBuy({ ...base, rent: 3_000, appreciation: 0, investReturn: 0.08 }).diff).toBeLessThan(0);
    const b = rentVsBuy({ ...base, rent: 12_000, appreciation: 0.06, investReturn: 0.02 });
    expect(b.diff).toBeGreaterThan(0);
    expect(b.breakEven).not.toBeNull();
  });
});

describe("amendment190", () => {
  const base = { balance: 1_000_000, realGainShare: 0.4, age: 62, qualifyingPension: 6_000, annuityFactor: 200, ...IL.amendment190 };
  it("annuity = balance / factor; tax saved = 15% of real gain", () => {
    const r = amendment190(base);
    expect(r.monthly).toBe(5_000);
    expect(r.taxSaved).toBe(60_000);
    expect(r.eligible).toBe(true);
  });
  it("needs age 60 and the minimum qualifying pension", () => {
    expect(amendment190({ ...base, age: 59 }).ageOk).toBe(false);
    expect(amendment190({ ...base, qualifyingPension: 5_000 }).eligible).toBe(false);
  });
});

describe("wellbeing", () => {
  it("scores 0–100 with the positive item reversed", () => {
    expect(wellbeingScore([4, 4, 4, 0, 4])).toBe(100);
    expect(wellbeingScore([0, 0, 0, 4, 0])).toBe(0);
    expect(wellbeingScore([2, 2, 2, 2, 2])).toBe(50);
    expect(wellbeingScore([1, 2])).toBeNull();
    expect(wellbeingScore([5, 0, 0, 0, 0])).toBeNull();
  });
  it("is due after 90 days or with no history; drops bad rows", () => {
    expect(wellbeingDue([], "2026-11-06")).toBe(true);
    expect(wellbeingDue([{ date: "2026-09-01", score: 50 }], "2026-11-06")).toBe(false);
    expect(wellbeingDue([{ date: "2026-07-01", score: 50 }], "2026-11-06")).toBe(true);
    expect(parseWellbeingHistory([{ date: "x", score: 1 }, { date: "2026-01-01", score: 120 }, { date: "2026-02-01", score: 40 }])).toEqual([{ date: "2026-02-01", score: 40 }]);
  });
});

describe("competitor-gap calculators", () => {
  it("prepay vs invest: a 6% loan beats a 6% taxed return", async () => {
    const { payoffVsInvest } = await import("@/lib/tools");
    const r = payoffVsInvest(100_000, 0.06, 0.06, 10);
    expect(r.saved).toBeCloseTo(79_085, 0);
    expect(r.diff).toBeLessThan(0);
    expect(payoffVsInvest(100_000, 0.02, 0.07, 10).diff).toBeGreaterThan(0);
  });

  it("rental yield: gross, net and cash on cash", async () => {
    const { rentalYield } = await import("@/lib/tools");
    const r = rentalYield({ price: 1_200_000, equity: 1_200_000, rent: 4_000, costs: 500, rate: 0.05, years: 25 });
    expect(r.gross).toBeCloseTo(0.04);
    expect(r.net).toBeCloseTo(0.035);
    expect(r.cashOnCash).toBeCloseTo(0.035);
    expect(rentalYield({ price: 1_200_000, equity: 400_000, rent: 4_000, costs: 500, rate: 0.05, years: 25 }).cashflow).toBeLessThan(0);
  });

  it("money-market fund taxes only the real gain", async () => {
    const { moneyMarket } = await import("@/lib/tools");
    expect(moneyMarket(100_000, 1, 4, 0, 2).net).toBeCloseTo(103_500);
    expect(moneyMarket(100_000, 1, 1, 0, 2).net).toBeCloseTo(101_000);
  });
});
