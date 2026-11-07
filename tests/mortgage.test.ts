import { describe, expect, it } from "vitest";
import { MORTGAGE_DEFAULTS as D, mortgage, simulateTrack } from "@/lib/mortgage";

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
    const shock = simulateTrack({ kind: "prime", share: 1, ratePct: 0, years: 20 }, 100_000, { ...env, primeShock: 2 });
    expect(shock.maxPayment).toBeGreaterThan(base.maxPayment);
    expect(shock.firstPayment).toBeCloseTo(base.firstPayment);
  });

  it("grows a linked track's payment with inflation", () => {
    const r = simulateTrack({ kind: "fixedLinked", share: 1, ratePct: 3, years: 20 }, 100_000, { ...env, inflationPct: 3 });
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
    const m = mortgage({ ...D, tracks: [{ kind: "prime", share: 1, ratePct: 0, years: 25 }], propertyValue: 1_400_000, income: 15_000 });
    expect(m.warnings.fixed).toBe(true);
    expect(m.warnings.ltv).toBe(true);
    expect(m.warnings.pti).toBe("high");
  });

  it("flags shares that don't add up to 100%", () => {
    expect(mortgage({ ...D, tracks: [{ ...D.tracks[0], share: 0.5 }] }).warnings.shares).toBe(true);
  });
});
