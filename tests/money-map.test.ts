import { describe, it, expect } from "vitest";
import { buildMoneyMap } from "@/lib/money-map";
import type { Asset } from "@/lib/types";

const a = (type: string, valueIls: number | null, isLiability = false, name = "x") =>
  ({ type, name, valueIls, isLiability }) as unknown as Asset;
const base = { forecast: 1000, expenses: 10000, emergencyMonths: 6, hasHomeEvent: false };
const row = (m: ReturnType<typeof buildMoneyMap>, area: string) => [...m.rows, ...m.more].find((r) => r.area === area)!;

describe("buildMoneyMap", () => {
  it("assets null: no numbers on asset rows, no net worth", () => {
    const m = buildMoneyMap({ ...base, assets: null });
    expect(m.rows.map((r) => r.area)).toEqual(["cashflow", "cushion", "investments", "pension", "debts"]);
    for (const r of m.rows.slice(1)) expect(r.value).toBeNull();
    expect(row(m, "cashflow").value).toBe(1000);
    expect(row(m, "property")).toMatchObject({ value: null });
    expect(m.more.map((r) => r.area)).toEqual(["property"]);
  });
  it("cushion months and target; null when no cash", () => {
    const m = buildMoneyMap({ ...base, assets: [a("cash", 25000)] });
    expect(row(m, "cushion")).toMatchObject({ value: 25000, months: 2.5, target: 60000, href: "/investments" });
    expect(row(buildMoneyMap({ ...base, assets: [a("stock", 5)] }), "cushion").value).toBeNull();
  });
  it("unknown forecast stays null; null valueIls contributes nothing", () => {
    const m = buildMoneyMap({ ...base, forecast: null, assets: [a("stock", null)] });
    expect(row(m, "cashflow")).toMatchObject({ value: null, href: "/?view=detail" });
    expect(row(m, "investments").value).toBeNull();
  });
  it("debts: sums, counts, and 0 when none", () => {
    const m = buildMoneyMap({ ...base, assets: [a("loan", 300, true), a("loan", 200, true), a("cash", 10)] });
    expect(row(m, "debts")).toMatchObject({ value: 500, count: 2 });
    expect(row(buildMoneyMap({ ...base, assets: [a("cash", 10)] }), "debts")).toMatchObject({ value: 0, count: 0 });
  });
  it("property goes to more without home event, rows with it or value", () => {
    expect(buildMoneyMap({ ...base, assets: [a("cash", 1)] }).more.map((r) => r.area)).toEqual(["property"]);
    expect(buildMoneyMap({ ...base, hasHomeEvent: true, assets: [a("cash", 1)] }).rows.map((r) => r.area)).toContain("property");
    expect(buildMoneyMap({ ...base, assets: [a("real_estate", 900)] }).rows.map((r) => r.area)).toContain("property");
  });
  it("net worth = assets - liabilities with 3 areas, omitted with fewer", () => {
    const m = buildMoneyMap({ ...base, assets: [a("cash", 1000), a("stock", 2000), a("pension", 3000), a("loan", 500, true)] });
    expect(row(m, "investments").value).toBe(2000);
    expect(row(m, "pension")).toMatchObject({ value: 3000, href: "/fi" });
    expect(m.rows[m.rows.length - 1]).toMatchObject({ area: "netWorth", value: 5500, href: "/fi" });
    expect(buildMoneyMap({ ...base, assets: [a("cash", 1000)] }).rows.some((r) => r.area === "netWorth")).toBe(false);
  });
  it("unknown liability size is not 0 debts", () => {
    expect(row(buildMoneyMap({ ...base, assets: [a("loan", null, true)] }), "debts")).toMatchObject({ value: null, count: 1 });
    expect(row(buildMoneyMap({ ...base, assets: [a("loan", null, true), a("loan", 40, true)] }), "debts")).toMatchObject({ value: 40, count: 2 });
  });
  it("net worth appears at exactly 2 areas, not with cash + zero debts", () => {
    const two = buildMoneyMap({ ...base, assets: [a("cash", 100), a("stock", 50)] });
    expect(two.rows[two.rows.length - 1]).toMatchObject({ area: "netWorth", value: 150 });
    expect(buildMoneyMap({ ...base, assets: [a("cash", 100)] }).rows.some((r) => r.area === "netWorth")).toBe(false);
  });
  it("no months/target when expenses unknown or 0", () => {
    for (const expenses of [null, 0]) {
      const c = row(buildMoneyMap({ ...base, expenses, assets: [a("cash", 100)] }), "cushion");
      expect(c.months).toBeUndefined();
      expect(c.target).toBeUndefined();
    }
  });
});
