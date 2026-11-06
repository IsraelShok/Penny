import { describe, expect, it } from "vitest";
import { DEFAULT_RULE, ledger, parseSplitRule, parseSplitRules, type SettleRow } from "@/lib/settle";
import { childSummary } from "@/lib/kids";

const acc = { A: "me", B: "p" };
const row = (date: string, amount: number, owner: string | null, accountNumber: string): SettleRow => ({ id: 1, date, amount, owner, accountNumber, description: "x" });

describe("ledger", () => {
  it("splits shared costs 50/50 and counts one-sided costs in full", () => {
    const rows = [
      row("2026-01-02", -100, "shared", "A"), // +50
      row("2026-01-03", -40, "shared", "B"), // -20
      row("2026-01-04", -30, "p", "A"), // +30
      row("2026-01-05", -10, "me", "B"), // -10
      row("2026-01-06", -99, "me", "A"), // own cost, nothing
    ];
    expect(ledger(rows, acc, "me", "p", DEFAULT_RULE, [], "2026-12-31").balance).toBe(50);
  });

  it("uses a custom share and ignores refunds and future rows", () => {
    const rows = [row("2026-01-02", -100, "shared", "A"), row("2026-01-03", 20, "shared", "A"), row("2027-01-01", -100, "shared", "A")];
    expect(ledger(rows, acc, "me", "p", { myShare: 70, support: null }, [], "2026-12-31").balance).toBe(30);
  });

  it("zeroes from the last settle-up date", () => {
    const rows = [row("2026-01-02", -100, "shared", "A"), row("2026-02-02", -10, "shared", "A")];
    const entries = [{ id: 1, counterpart: "p", date: "2026-01-31", amount: 50 }, { id: 2, counterpart: "q", date: "2026-03-01", amount: 1 }];
    const l = ledger(rows, acc, "me", "p", DEFAULT_RULE, entries, "2026-12-31");
    expect(l.balance).toBe(5);
    expect(l.since).toBe("2026-01-31");
  });

  it("counts child support per month", () => {
    const rule = { myShare: 50, support: { monthly: 1000, direction: "pay" as const, start: "2025-11" } };
    expect(ledger([], acc, "me", "p", rule, [], "2026-02-15").balance).toBe(-4000);
    const after = [{ id: 1, counterpart: "p", date: "2026-01-10", amount: 3000 }];
    expect(ledger([], acc, "me", "p", rule, after, "2026-02-15").balance).toBe(-1000);
  });
});

describe("parseSplitRule(s)", () => {
  it("validates input", () => {
    expect(() => parseSplitRule({ myShare: 120 })).toThrow();
    expect(() => parseSplitRule({ myShare: 50, support: { monthly: 1, direction: "x", start: "2026-01" } })).toThrow();
    expect(parseSplitRules({ p: { myShare: 40 }, gone: { myShare: 1 }, bad: {} }, ["p", "bad"])).toEqual({ p: { myShare: 40, support: null } });
  });
});

describe("childSummary", () => {
  it("totals month, year and top categories", () => {
    const s = childSummary([
      { date: "2026-03-02", amount: -100, category: "חוגים" },
      { date: "2026-01-02", amount: -50, category: "בגדים" },
      { date: "2026-03-05", amount: 20, category: "חוגים" },
      { date: "2025-03-05", amount: -999, category: "חוגים" },
    ], "2026-03");
    expect(s).toEqual({ month: 80, year: 130, top: [{ category: "חוגים", total: 80 }, { category: "בגדים", total: 50 }] });
  });
});
