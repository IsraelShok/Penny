import { describe, expect, it } from "vitest";
import { CAR_DEFAULTS, SHARED_DEFAULTS, carCost, monthlyPayment, type CarInputs } from "@/lib/car-cost";

const car = (type: CarInputs["type"], p: Partial<CarInputs> = {}): CarInputs => ({
  ...CAR_DEFAULTS[type], price: 150_000, downShare: 1, loanRate: 0.07, loanYears: 5, ...p,
});

describe("carCost", () => {
  it("adds up its parts", () => {
    const c = carCost(car("gas"), SHARED_DEFAULTS);
    const parts = c.depreciation + c.interest + c.energy + c.insurance + c.maintenance + c.license + c.missedReturn;
    expect(c.total).toBeCloseTo(parts);
    expect(c.perMonth).toBeCloseTo(c.total / 60);
  });

  it("prices energy from km, consumption and price", () => {
    const s = { ...SHARED_DEFAULTS, years: 1, kmPerYear: 10_000 };
    expect(carCost(car("gas"), s).energy).toBeCloseTo(100 * 7.5 * 7.2);
    expect(carCost(car("ev"), s).energy).toBeCloseTo(100 * 16 * 0.64);
    expect(carCost(car("phev"), s).energy).toBeCloseTo(100 * (0.4 * 6 * 7.2 + 0.6 * 18 * 0.64));
  });

  it("charges no interest when paid in cash, and counts the missed return instead", () => {
    const cash = carCost(car("ev"), SHARED_DEFAULTS);
    expect(cash.interest).toBe(0);
    expect(cash.missedReturn).toBeCloseTo(150_000 * (1.06 ** 5 - 1));
  });

  it("charges interest on a loan and counts the return missed on its payments too", () => {
    const c = carCost(car("ev", { downShare: 0.2 }), SHARED_DEFAULTS);
    expect(c.interest).toBeGreaterThan(0);
    expect(c.monthlyLoanPayment).toBeCloseTo(monthlyPayment(120_000, 0.07, 5));
    expect(c.missedReturn).toBeGreaterThan(30_000 * (1.06 ** 5 - 1));
  });

  it("makes a loan dearer than cash when its rate beats the investment return", () => {
    const s = { ...SHARED_DEFAULTS, investReturn: 0.04 };
    expect(carCost(car("gas", { downShare: 0.2, loanRate: 0.09 }), s).total).toBeGreaterThan(carCost(car("gas"), s).total);
  });

  it("depreciates to the 5-year resale share", () => {
    expect(carCost(car("gas"), SHARED_DEFAULTS).resaleValue).toBeCloseTo(150_000 * 0.55);
  });
});

describe("monthlyPayment", () => {
  it("splits evenly at 0%", () => expect(monthlyPayment(12_000, 0, 1)).toBe(1_000));
  it("matches the annuity formula", () => expect(monthlyPayment(100_000, 0.06, 5)).toBeCloseTo(1933.28, 1));
});
