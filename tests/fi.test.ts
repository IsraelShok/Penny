import { describe, expect, it } from "vitest";
import { carCost, fiNumber, yearsToTarget } from "@/lib/fi";

describe("fiNumber", () => {
  it("is spending over the withdrawal rate", () => {
    expect(fiNumber(120_000, 0.04)).toBe(3_000_000);
    expect(fiNumber(102_000, 0.03)).toBeCloseTo(3_400_000);
  });
});

describe("yearsToTarget", () => {
  it("matches HaExolidit's example: save 80% of 10k at 5% and 4% withdrawal", () => {
    // Their sheet answers 5.57 years from zero; monthly compounding lands close to it.
    const years = yearsToTarget(0, 8_000, 0.05, fiNumber(24_000, 0.04))!;
    expect(years).toBeGreaterThan(5.3);
    expect(years).toBeLessThan(5.8);
  });

  it("handles already-there and never", () => {
    expect(yearsToTarget(1_000, 0, 0.05, 500)).toBe(0);
    expect(yearsToTarget(0, 0, 0, 1)).toBeNull();
  });
});

describe("carCost", () => {
  it("matches HaExolidit's car example", () => {
    const c = carCost({
      purchasePrice: 36_900, currentValue: 34_000, kmDriven: 41_220, kmPerYear: 11_206, kmPerLiter: 12.7,
      fuelPrice: 6.82, annualTest: 1_374, annualInsurance: 2_000, annualMaintenance: 1_960,
    })!;
    expect(c.years).toBeCloseTo(3.68, 2);
    expect(c.perYear).toBeCloseTo(12_140.1, 0);
    expect(c.perKm).toBeCloseTo(1.08, 2);
  });
});
