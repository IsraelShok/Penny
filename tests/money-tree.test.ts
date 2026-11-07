import { describe, expect, it } from "vitest";
import { moneyTree } from "@/lib/money-tree";

describe("moneyTree", () => {
  it("is a seed with no or negative net worth", () => {
    expect(moneyTree(0, []).stage).toBe(0);
    expect(moneyTree(-20_000, []).stage).toBe(0);
    expect(moneyTree(-20_000, []).progress).toBe(0);
  });

  it("picks the stage and progress toward the next one", () => {
    const t = moneyTree(100_000, []);
    expect(t.stage).toBe(2);
    expect(t.progress).toBeCloseTo(0.5);
    expect(t.toNext).toBe(50_000);
  });

  it("stops growing at the last stage", () => {
    const t = moneyTree(9_000_000, []);
    expect(t.stage).toBe(6);
    expect(t.progress).toBe(1);
    expect(t.toNext).toBeNull();
  });

  it("compares with about 30 days earlier for the trend", () => {
    const history = [
      { date: "2026-09-01", netWorth: 80_000 },
      { date: "2026-10-01", netWorth: 90_000 },
      { date: "2026-10-20", netWorth: 95_000 },
      { date: "2026-11-05", netWorth: 100_000 },
    ];
    const t = moneyTree(100_000, history);
    expect(t.change).toBe(10_000);
    expect(t.trend).toBe("up");
  });

  it("treats small moves as flat and drops as down", () => {
    const flat = [{ date: "2026-10-01", netWorth: 100_000 }, { date: "2026-11-01", netWorth: 100_200 }];
    expect(moneyTree(100_200, flat).trend).toBe("flat");
    const down = [{ date: "2026-10-01", netWorth: 100_000 }, { date: "2026-11-01", netWorth: 90_000 }];
    expect(moneyTree(90_000, down).trend).toBe("down");
  });
});
