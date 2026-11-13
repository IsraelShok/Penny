import { describe, expect, it } from "vitest";
import { allocate } from "@/lib/allocation";

describe("allocate", () => {
  it("splits 15k income / 10k expenses with nothing saved: all surplus to the buffer first", () => {
    const a = allocate({ income: 15000, expenses: 10000, liquidNow: 0 });
    expect(a.targets).toEqual({ need: 7500, want: 4500, saving: 3000 });
    expect(a.surplus).toBe(5000);
    expect(a.hold).toEqual({ liquid: 10000, moneyMarket: 50000, emergency: 60000 });
    expect(a.monthly).toEqual({ liquid: 5000, moneyMarket: 0, market: 0 });
    expect(a.monthsToFull).toBe(12);
  });
  it("fills the money-market fund once the buffer is there", () => {
    const a = allocate({ income: 15000, expenses: 10000, liquidNow: 58000 });
    expect(a.monthly).toEqual({ liquid: 0, moneyMarket: 2000, market: 3000 });
  });
  it("sends everything to investing once the emergency fund is full", () => {
    const a = allocate({ income: 15000, expenses: 10000, liquidNow: 70000 });
    expect(a.monthly).toEqual({ liquid: 0, moneyMarket: 0, market: 5000 });
    expect(a.monthsToFull).toBe(0);
  });
  it("never fills when spending exceeds income", () => {
    const a = allocate({ income: 8000, expenses: 10000, liquidNow: 0 });
    expect(a.surplus).toBe(0);
    expect(a.monthsToFull).toBeNull();
  });
});

describe("liquidCash", () => {
  it("counts cash, deposits and money-market funds, not stocks", async () => {
    const { liquidCash } = await import("@/lib/allocation");
    expect(liquidCash([
      { type: "cash", name: "עו\"ש", isLiability: false, valueIls: 6500 },
      { type: "fund", name: "קרן כספית", isLiability: false, valueIls: 12000 },
      { type: "stock", name: "תיק", isLiability: false, valueIls: 45000 },
    ])).toBe(18500);
  });
});
