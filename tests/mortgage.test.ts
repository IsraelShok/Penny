import { describe, expect, it } from "vitest";
import {
  MORTGAGE_DEFAULTS as D,
  mortgage,
  prepayFee,
  prepayVsInvest,
  simulateTrack,
} from "@/lib/mortgage";

const env = { inflationPct: 0, primePct: 5, primeShock: 0 };

describe("simulateTrack", () => {
  it("matches the annuity formula on a fixed track", () => {
    const r = simulateTrack({ kind: "fixed", share: 1, ratePct: 6, years: 5 }, 100_000, env);
    expect(r.firstPayment).toBeCloseTo(1933.28, 1);
    expect(r.maxPayment).toBeCloseTo(r.firstPayment, 6);
    expect(r.totalPaid).toBeCloseTo(1933.28 * 60, -1);
  });

  it("charges prime plus the spread", () => {
    const prime = simulateTrack({ kind: "prime", share: 1, ratePct: 1, years: 5 }, 100_000, env);
    expect(prime.firstPayment).toBeCloseTo(1933.28, 1);
  });

  it("raises the payment when prime rises", () => {
    const base = simulateTrack({ kind: "prime", share: 1, ratePct: 0, years: 20 }, 100_000, env);
    const shock = simulateTrack({ kind: "prime", share: 1, ratePct: 0, years: 20 }, 100_000, {
      ...env,
      primeShock: 2,
    });
    expect(shock.maxPayment).toBeGreaterThan(base.maxPayment);
    expect(shock.firstPayment).toBeCloseTo(base.firstPayment);
  });

  it("grows a linked track's payment with inflation", () => {
    const r = simulateTrack({ kind: "fixedLinked", share: 1, ratePct: 3, years: 20 }, 100_000, {
      ...env,
      inflationPct: 3,
    });
    expect(r.maxPayment).toBeGreaterThan(r.firstPayment * 1.5);
  });
});

describe("mortgage", () => {
  it("sums tracks and passes the default checks", () => {
    const m = mortgage(D);
    expect(m.firstPayment).toBeCloseTo(m.tracks.reduce((s, t) => s + t.firstPayment, 0));
    expect(m.warnings).toEqual({ shares: false, fixed: false, ltv: false, pti: null });
  });

  it("flags too much prime, high LTV and a heavy payment", () => {
    const m = mortgage({
      ...D,
      tracks: [{ kind: "prime", share: 1, ratePct: 0, years: 25 }],
      propertyValue: 1_400_000,
      income: 15_000,
    });
    expect(m.warnings.fixed).toBe(true);
    expect(m.warnings.ltv).toBe(true);
    expect(m.warnings.pti).toBe("high");
  });

  it("flags shares that don't add up to 100%", () => {
    expect(mortgage({ ...D, tracks: [{ ...D.tracks[0], share: 0.5 }] }).warnings.shares).toBe(true);
  });
});

describe("var5 tracks and the BoI checks", () => {
  it("keeps the rate for 5 years, then moves it by the shock", () => {
    const flat = simulateTrack({ kind: "var5", share: 1, ratePct: 5, years: 20 }, 100_000, env);
    const up = simulateTrack({ kind: "var5", share: 1, ratePct: 5, years: 20 }, 100_000, {
      ...env,
      primeShock: 2,
    });
    expect(up.firstPayment).toBeCloseTo(flat.firstPayment);
    expect(up.maxPayment).toBeGreaterThan(flat.maxPayment);
  });

  it("indexes a linked var5 track", () => {
    const r = simulateTrack({ kind: "var5Linked", share: 1, ratePct: 3, years: 20 }, 100_000, {
      ...env,
      inflationPct: 3,
    });
    expect(r.maxPayment).toBeGreaterThan(r.firstPayment * 1.5);
  });

  it("counts var5 as variable for the one-third fixed rule", () => {
    const m = mortgage({
      ...D,
      tracks: [
        { kind: "prime", share: 0.5, ratePct: -0.5, years: 25 },
        { kind: "var5", share: 0.5, ratePct: 4.5, years: 25 },
      ],
    });
    expect(m.fixedShare).toBe(0);
    expect(m.warnings.fixed).toBe(true);
  });

  it("caps LTV by buyer type", () => {
    const at60 = { ...D, loan: 600_000, propertyValue: 1_000_000 };
    expect(mortgage({ ...at60, buyer: "first" }).warnings.ltv).toBe(false);
    expect(mortgage({ ...at60, buyer: "investor" }).warnings.ltv).toBe(true);
    expect(mortgage({ ...at60, loan: 720_000, buyer: "upgrade" }).warnings.ltv).toBe(true);
  });

  it("flags payment over half of income", () => {
    expect(mortgage({ ...D, income: 10_000 }).warnings.pti).toBe("over");
  });
});

describe("prepayFee", () => {
  it("is zero when today's rate is at or above yours", () => {
    expect(prepayFee({ amount: 100_000, ratePct: 4, marketRatePct: 4.5, monthsLeft: 240 })).toBe(0);
    expect(prepayFee({ amount: 100_000, ratePct: 4, marketRatePct: 4, monthsLeft: 240 })).toBe(0);
  });

  it("charges more the more rates fell and the longer is left", () => {
    const small = prepayFee({ amount: 100_000, ratePct: 5, marketRatePct: 4, monthsLeft: 120 });
    const big = prepayFee({ amount: 100_000, ratePct: 5, marketRatePct: 3, monthsLeft: 240 });
    expect(small).toBeGreaterThan(0);
    expect(big).toBeGreaterThan(small);
  });

  it("stops at the next reset on a var5 track", () => {
    const full = prepayFee({ amount: 100_000, ratePct: 5, marketRatePct: 3, monthsLeft: 240 });
    const toReset = prepayFee({
      amount: 100_000,
      ratePct: 5,
      marketRatePct: 3,
      monthsLeft: 240,
      horizonMonths: 24,
    });
    expect(toReset).toBeGreaterThan(0);
    expect(toReset).toBeLessThan(full);
  });
});

describe("prepayVsInvest", () => {
  const base = { amount: 100_000, fee: 0, ratePct: 5, years: 20, taxRate: 0.25 };
  it("prefers investing when the net return beats the mortgage rate", () => {
    expect(prepayVsInvest({ ...base, returnPct: 9 }).better).toBe("invest");
  });
  it("prefers prepaying when the return is below the rate", () => {
    expect(prepayVsInvest({ ...base, returnPct: 3 }).better).toBe("prepay");
  });
  it("a fee lowers the prepay side", () => {
    expect(prepayVsInvest({ ...base, fee: 5_000, returnPct: 5 }).prepay).toBeLessThan(
      prepayVsInvest({ ...base, returnPct: 5 }).prepay,
    );
  });
});
