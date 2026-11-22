import { describe, expect, it } from "vitest";
import { inflation, leaseVsBuy, loan, savingsGoal, split503020 } from "@/lib/calculators";
import { projectBalance, debtPayoff } from "@/lib/plan";
import { brokerOutcome, gemelVsBroker } from "@/lib/tools";

// Edge values a person can type into a calculator field (after the page's own parsing, which maps junk to 0).
const EDGES = [0, -0, 0.01, 1, 123.456789, 1e9, 1e15];

describe("calculator boundaries", () => {
  it("huge year counts finish fast instead of freezing the page", () => {
    const t = performance.now();
    projectBalance(1000, 100, 1e15, 0.05, 0, 0);
    gemelVsBroker({
      initial: 1000,
      monthly: 100,
      years: 1e9,
      grossReturn: 0.05,
      inflation: 0.02,
      gemelFeePct: 0.5,
      etfFeePct: 0.1,
      custodyMonthly: 0,
    });
    brokerOutcome(
      { perTrade: 5, pct: 0.1, custodyMonthly: 0 } as Parameters<typeof brokerOutcome>[0],
      1000,
      1,
      1e9,
      0.05,
    );
    expect(performance.now() - t).toBeLessThan(500);
  });

  it("ordinary edge inputs never produce NaN", () => {
    for (const a of EDGES)
      for (const b of EDGES.slice(0, 5))
        for (const y of EDGES.slice(0, 5)) {
          const vals = [
            ...Object.values(loan({ amount: a, ratePct: b, years: y })),
            ...Object.values(inflation(a, b, y)),
            savingsGoal(a, b, y, b),
            ...Object.values(split503020(a)),
            ...Object.values(
              leaseVsBuy({
                price: a,
                residualPct: b,
                years: y,
                ratePct: b,
                leaseMonthly: a,
                leaseUpfront: 0,
              }),
            ),
            projectBalance(a, b, y, b / 100, 0, 0),
            ...Object.values(debtPayoff(a, b, y) ?? {}),
          ];
          for (const v of vals) expect(Number.isNaN(v), `a=${a} b=${b} y=${y}`).toBe(false);
        }
  });
});
