import { describe, expect, it } from "vitest";
import { bracketTax, netSalary } from "@/lib/net-salary";

// Worked by hand from the 2026 rates in il-defaults (widened 20%/31% brackets; BL reduced band ₪7,703).
// Not cross-checked against a live official calculator; re-check when rates change.
describe("netSalary", () => {
  it("₪10,000, man, 6% pension, 2.5% study fund", () => {
    const r = netSalary({ gross: 10_000, sex: "man" });
    expect(r.incomeTax).toBeCloseTo(1119.6 - 544.5 - 210, 1); // 365.1
    expect(r.bituach).toBeCloseTo(7703 * 0.0427 + 2297 * 0.1217, 1);
    expect(r.net).toBeCloseTo(10_000 - 365.1 - 608.46 - 600 - 250, 0);
  });

  it("₪20,000, woman, no study fund", () => {
    const r = netSalary({ gross: 20_000, sex: "woman", studyFundRate: 0 });
    // 701 + 427 + 1,788 (20% up to ₪19,000) + 310 (31%)
    expect(bracketTax(20_000)).toBeCloseTo(3226, 1);
    // minus 2.75 points (665.5) and the pension credit (237.65)
    expect(r.incomeTax).toBeCloseTo(2322.85, 1);
    expect(r.bituach).toBeCloseTo(7703 * 0.0427 + 12297 * 0.1217, 1);
    expect(r.net).toBeCloseTo(20_000 - 2322.85 - 1825.46 - 1200, 0);
    expect(r.effectiveTaxRate).toBeCloseTo((2322.85 + 1825.46) / 20_000, 3);
  });

  it("low salary: credits wipe out income tax, never negative", () => {
    const r = netSalary({ gross: 6_000, sex: "man" });
    expect(r.incomeTax).toBe(0);
    expect(r.net).toBeCloseTo(5233.8, 1);
  });

  it("extra credit points lower the tax", () => {
    expect(netSalary({ gross: 15_000, sex: "man", extraPoints: 1 }).incomeTax).toBeCloseTo(netSalary({ gross: 15_000, sex: "man" }).incomeTax - 242, 5);
  });
});
