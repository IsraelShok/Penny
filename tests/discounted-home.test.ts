import { describe, expect, it } from "vitest";
import { DISCOUNTED_HOME_DEFAULTS as D, discountedVsMarket } from "@/lib/discounted-home";

describe("discountedVsMarket", () => {
  it("caps the discount", () => {
    expect(discountedVsMarket({ ...D, marketPrice: 1_000_000 }).discount).toBe(200_000);
    expect(discountedVsMarket({ ...D, marketPrice: 3_000_000 }).discount).toBe(300_000);
  });

  it("indexes the linked share until the keys", () => {
    const r = discountedVsMarket({ ...D, yearsToKeys: 2, indexRate: 0.05, linkedShare: 1 });
    expect(r.discounted.price).toBeCloseTo(1_700_000 * 1.05 ** 2);
  });

  it("pays rent only while waiting, and no rent on the market path", () => {
    const r = discountedVsMarket({ ...D, rent: 5_000, rentGrowth: 0, yearsToKeys: 3 });
    expect(r.discounted.rentPaid).toBeCloseTo(5_000 * 36);
    expect(r.market.rentPaid).toBe(0);
  });

  it("is a clear win with no wait and no indexation", () => {
    const r = discountedVsMarket({ ...D, yearsToKeys: 0, indexRate: 0 });
    expect(r.diff).toBeGreaterThan(r.discount);
  });

  it("loses its edge when the wait is long and rent is high", () => {
    const quick = discountedVsMarket({ ...D, yearsToKeys: 1 }).diff;
    const slow = discountedVsMarket({ ...D, yearsToKeys: 6, rent: 9_000 }).diff;
    expect(slow).toBeLessThan(quick);
  });

  it("adds purchase tax above the first-home exemption", () => {
    const r = discountedVsMarket({ ...D, marketPrice: 2_200_000 });
    expect(r.market.purchaseTax).toBeGreaterThan(0);
  });
});
