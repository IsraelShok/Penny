import { describe, expect, it } from "vitest";
import { ageOfMoney } from "@/lib/age-of-money";

describe("ageOfMoney", () => {
  it("spends from the oldest income first", () => {
    const txns = [
      { date: "2026-01-01", amount: 1000 },
      { date: "2026-01-15", amount: 1000 },
      { date: "2026-01-21", amount: -1000 }, // all from Jan 1 → 20 days
      { date: "2026-01-25", amount: -500 }, // from Jan 15 → 10 days
    ];
    // (20*1000 + 10*500) / 1500
    expect(ageOfMoney(txns)).toBe(17);
  });

  it("splits an expense across buckets", () => {
    expect(
      ageOfMoney([
        { date: "2026-01-01", amount: 100 },
        { date: "2026-01-11", amount: 100 },
        { date: "2026-01-21", amount: -200 },
      ]),
    ).toBe(15);
  });

  it("uses only the last 10 expenses and ignores unfunded spending", () => {
    const txns = [{ date: "2026-01-01", amount: 1100 }];
    txns.push({ date: "2026-01-02", amount: -100 }); // dropped: 11th from the end
    for (let d = 10; d < 20; d++) txns.push({ date: `2026-01-${d}`, amount: -100 });
    txns.push({ date: "2026-01-25", amount: -500 }); // nothing left to fund it
    expect(ageOfMoney(txns)).toBe(14); // ages 9..18, mean 13.5
  });

  it("is null with nothing to age", () => {
    expect(ageOfMoney([])).toBeNull();
    expect(ageOfMoney([{ date: "2026-01-01", amount: -50 }])).toBeNull();
  });
});
