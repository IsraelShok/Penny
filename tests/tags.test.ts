import { describe, expect, it } from "vitest";
import { normalizeTag, ownerSummary, tagBreakdown, tagTotals, walletBalance } from "@/lib/tags";

describe("tags", () => {
  it("normalizes tags", () => {
    expect(normalizeTag("  טיול   לאילת ")).toBe("טיול לאילת");
    expect(normalizeTag("   ")).toBeNull();
    expect(normalizeTag("x".repeat(41))).toBeNull();
    expect(normalizeTag(3)).toBeNull();
  });

  const rows = [
    { tag: "אילת", amount: -800, date: "2026-07-02", category: "Lodging" },
    { tag: "אילת", amount: -200, date: "2026-07-01", category: "Restaurants" },
    { tag: "אילת", amount: 100, date: "2026-07-05", category: "Lodging" }, // refund
    { tag: "חתונה", amount: -5000, date: "2026-08-10", category: null },
  ];

  it("totals per tag with count and date range, biggest first", () => {
    expect(tagTotals(rows)).toEqual([
      { tag: "חתונה", total: 5000, count: 1, from: "2026-08-10", to: "2026-08-10" },
      { tag: "אילת", total: 900, count: 3, from: "2026-07-01", to: "2026-07-05" },
    ]);
  });

  it("breaks a tag down by category", () => {
    expect(tagBreakdown(rows, "אילת")).toEqual([
      { category: "Lodging", total: 700 },
      { category: "Restaurants", total: 200 },
    ]);
  });
});

describe("ownerSummary", () => {
  const members = ["a", "b"];
  const accounts = { "1111": "a", "2222": "b", "3333": "shared" };

  it("splits by owner and falls back to the account default", () => {
    const s = ownerSummary(
      [
        { amount: -100, owner: null, accountNumber: "1111" },
        { amount: -50, owner: "b", accountNumber: "1111" },
        { amount: -30, owner: null, accountNumber: "9999" },
      ],
      accounts,
      members,
    );
    expect(s.byOwner).toEqual({ a: 100, b: 50 });
    expect(s.unset).toBe(30);
    expect(s.settlements).toEqual([]);
  });

  it("settles shared spending 50/50 based on who paid", () => {
    const s = ownerSummary(
      [
        { amount: -300, owner: "shared", accountNumber: "1111" }, // a paid
        { amount: -100, owner: "shared", accountNumber: "2222" }, // b paid
        { amount: -60, owner: null, accountNumber: "3333" }, // joint account: nobody owes
      ],
      accounts,
      members,
    );
    expect(s.byOwner.shared).toBe(460);
    expect(s.settlements).toEqual([{ from: "b", to: "a", amount: 100 }]);
  });

  it("ignores owners of removed members", () => {
    const s = ownerSummary([{ amount: -10, owner: "gone", accountNumber: "x" }], {}, members);
    expect(s.unset).toBe(10);
  });
});

describe("walletBalance", () => {
  it("withdrawals minus logged cash, floored at zero", () => {
    const w = walletBalance([
      { amount: -500, description: "משיכת מזומן כספומט", categoryName: null, provider: "hapoalim" },
      { amount: -200, description: "something", categoryName: "Cash & ATM", provider: "max" },
      { amount: -40, description: "שוק", categoryName: null, provider: "cash" },
      { amount: -90, description: "ATMOSPHERE BAR", categoryName: null, provider: "max" }, // not an ATM
    ]);
    expect(w).toEqual({ withdrawn: 700, logged: 40, balance: 660 });
    expect(walletBalance([{ amount: -40, description: "x", categoryName: null, provider: "cash" }]).balance).toBe(0);
  });
});
