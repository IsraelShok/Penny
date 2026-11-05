import { describe, expect, it } from "vitest";
import { fxMarkup, rateOn } from "@/lib/fx-markup";

const rates = {
  USD: [{ date: "2026-10-01", close: 3.7 }, { date: "2026-10-02", close: 3.8 }, { date: "2026-10-05", close: 3.75 }],
};

describe("rateOn", () => {
  it("takes the close on or before the date", () => {
    expect(rateOn(rates.USD, "2026-10-02")).toBe(3.8);
    expect(rateOn(rates.USD, "2026-10-04")).toBe(3.8);
    expect(rateOn(rates.USD, "2026-09-30")).toBeNull();
  });
});

describe("fxMarkup", () => {
  it("sums the markup over the market rate and averages it net", () => {
    const out = fxMarkup([
      { date: "2026-10-01", currency: "USD", original: -100, charged: -381.5 }, // fair 370: +11.5
      { date: "2026-10-03", currency: "USD", original: -10, charged: -37.9 }, // fair 38: -0.1, counts as 0
    ], rates);
    expect(out.count).toBe(2);
    expect(out.total).toBeCloseTo(11.5);
    expect(out.avgPct).toBeCloseTo((11.4 / 408) * 100);
  });
  it("skips charges without a rate or with an implausible gap", () => {
    const out = fxMarkup([
      { date: "2026-10-01", currency: "EUR", original: 100, charged: 400 },
      { date: "2026-09-01", currency: "USD", original: 100, charged: 370 },
      { date: "2026-10-01", currency: "USD", original: 100, charged: 185 }, // a partial charge, not a fee
    ], rates);
    expect(out).toEqual({ total: 0, avgPct: 0, count: 0 });
  });
});
