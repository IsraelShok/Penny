import { describe, expect, it } from "vitest";
import { monthlyGrowth, wealthGroups } from "@/lib/wealth-growth";
import type { Asset } from "@/lib/types";

const asset = (p: Partial<Asset>) =>
  ({ isLiability: false, valueIls: 1000, quote: null, fund: null, ...p }) as Asset;

describe("wealth growth", () => {
  it("uses the close 4 weeks back for quoted assets", () => {
    const a = asset({
      type: "stock",
      quote: { series: [80, 100, 0, 0, 0, 125] } as Asset["quote"],
    });
    expect(monthlyGrowth(a)).toBeCloseTo(200); // 1000 * (1 - 100/125)
  });

  it("spreads fund YTD over reported months", () => {
    const a = asset({
      type: "pension",
      fund: { fund: { ytd: 10, period: 202610 } } as Asset["fund"],
    });
    expect(monthlyGrowth(a)).toBeCloseTo(1000 * (0.01 / 1.01));
  });

  it("groups and skips liabilities and unpriced assets", () => {
    const g = wealthGroups([
      asset({ type: "study_fund" }),
      asset({ type: "pension", valueIls: null }),
      asset({ type: "mortgage", isLiability: true }),
    ]);
    expect(g.funds).toEqual({ value: 1000, growth: 0, estimated: false });
    expect(g.pension.value).toBe(0);
  });
});
