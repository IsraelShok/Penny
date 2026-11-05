import { describe, expect, it } from "vitest";
import { compareFund, searchFunds } from "@/lib/funds";
import type { Fund } from "@/lib/types";

const f = (id: number, name: string, avg5y: number, feeBalance: number, specialization = "כללי", totalAssets = 100): Fund => ({
  id, source: "gemel", name, company: "x", classification: "קרנות השתלמות", specialization, period: 202609,
  feeBalance, feeDeposit: 0, ytd: null, avg3y: null, avg5y, sharpe: null, totalAssets,
});

describe("funds", () => {
  const all = [f(1, "אלטשולר השתלמות כללי", 9, 0.7), f(2, "מור השתלמות כללי", 11, 0.5), f(3, "הראל השתלמות כללי", 7, 0.6), f(4, "מור השתלמות מניות", 15, 0.5, "מניות")];

  it("compares against funds on the same track only", () => {
    const c = compareFund(all[0], all);
    expect(c.peers).toMatchObject({ count: 3, avg5y: 9, feeBalance: 0.6 });
    expect(c.rank5y).toBe(2);
  });

  it("reads pension tracks from the name", () => {
    const p = (id: number, name: string): Fund => ({ ...f(id, name, 9, 0.2), source: "pension", classification: "קרנות חדשות", specialization: null });
    const pension = [p(1, "מגדל מקפת אישית מניות"), p(2, "הראל פנסיה מניות"), p(3, "הראל פנסיה כללי")];
    expect(compareFund(pension[0], pension).peers.count).toBe(2);
  });

  it("finds funds by every word, largest first", () => {
    expect(searchFunds(all, "מור השתלמות").map((x) => x.id)).toEqual([2, 4]);
    expect(searchFunds(all, " ")).toEqual([]);
  });
});
