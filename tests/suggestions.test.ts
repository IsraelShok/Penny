import { describe, expect, it } from "vitest";
import { buildSuggestions, taxYearFacts, type SuggestionTxn } from "@/lib/suggestions";

const ctx = { today: "2026-11-05", known: [], monthStartDay: 1, priceChanges: [] };
const t = (date: string, description: string, amount: number, kind = "expense", categoryName?: string): SuggestionTxn => ({ date, description, amount, kind, categoryName });

describe("buildSuggestions", () => {
  it("finds recurring insurance, loans and broker deposits", () => {
    const s = buildSuggestions([
      t("2026-09-02", "הראל ביטוח בריאות", -180), t("2026-10-02", "הראל ביטוח בריאות", -180),
      t("2026-09-10", "החזר משכנתא 123456", -6500), t("2026-10-10", "החזר משכנתא 123456", -6500),
      t("2026-09-15", "העברה לאקסלנס", -2000), t("2026-10-15", "העברה לאקסלנס", -2000),
      t("2026-10-20", "מגדל ביטוח רכב", -300), // only once: not recurring
    ], ctx);
    expect(s).toContainEqual(expect.objectContaining({ type: "policy", policyKind: "health", monthly: 180 }));
    expect(s).toContainEqual(expect.objectContaining({ type: "debt", debtType: "mortgage", monthly: 6500 }));
    expect(s).toContainEqual(expect.objectContaining({ type: "portfolio", monthly: 2000 }));
    expect(s.filter((x) => x.type === "policy")).toHaveLength(1);
  });

  it("skips what is already entered", () => {
    const s = buildSuggestions([t("2026-09-02", "הראל ביטוח בריאות", -180), t("2026-10-02", "הראל ביטוח בריאות", -180)], { ...ctx, known: ["הראל ביטוח בריאות"] });
    expect(s).toHaveLength(0);
  });

  it("totals bank fees and flags overdraft interest and double charges", () => {
    const s = buildSuggestions([
      ...Array.from({ length: 6 }, (_, i) => t(`2026-0${i + 4}-01`, "עמלת פעולה", -12)),
      t("2026-10-01", "ריבית חובה", -45),
      t("2026-10-20", "שופרסל דיל", -250.4), t("2026-10-20", "שופרסל דיל", -250.4),
    ], ctx);
    expect(s).toContainEqual(expect.objectContaining({ type: "fees", yearly: 72, count: 6 }));
    expect(s).toContainEqual(expect.objectContaining({ type: "interest", yearly: 45 }));
    expect(s).toContainEqual(expect.objectContaining({ type: "duplicate", amount: 250.4 }));
  });

  it("suggests the salary day as the month start", () => {
    const salary = ["2026-07-10", "2026-08-10", "2026-09-09", "2026-10-10"].map((d) => t(d, "משכורת", 18000, "income", "Salary"));
    expect(buildSuggestions(salary, ctx)).toContainEqual({ key: "payday:10", type: "payday", day: 10 });
    expect(buildSuggestions(salary, { ...ctx, monthStartDay: 10 })).toHaveLength(0);
  });

  it("suggests a rule for repeated corrections and an fx markup above the thresholds", () => {
    const s = buildSuggestions([], {
      ...ctx,
      ruleCandidates: [
        { merchant: "wolt", categoryId: 3, categoryName: "Restaurants", count: 2 },
        { merchant: "ikea", categoryId: 4, categoryName: "Home", count: 1 },
      ],
      fxMarkup: { total: 120, avgPct: 2.1, count: 14 },
    });
    expect(s).toEqual([
      { key: "rule:wolt:3", type: "rule", merchant: "wolt", categoryId: 3, categoryName: "Restaurants", count: 2 },
      { key: "fxMarkup:2026", type: "fxMarkup", total: 120, avgPct: 2.1, count: 14 },
    ]);
    expect(buildSuggestions([], { ...ctx, fxMarkup: { total: 120, avgPct: 0.3, count: 14 } })).toEqual([]);
    expect(buildSuggestions([], { ...ctx, fxMarkup: { total: 15, avgPct: 3, count: 2 } })).toEqual([]);
  });

  it("hints at a tax refund for two employers or a gap in salary", () => {
    const months = ["2024-01", "2024-12", "2025-01", "2025-12"];
    const rows = [
      ...["01", "02", "03", "04", "05", "06"].map((m) => ({ date: `2024-${m}-10`, description: "משכורת חברת אלפא" })),
      ...["07", "08", "09", "10", "11", "12"].map((m) => ({ date: `2024-${m}-10`, description: "משכורת חברת בטא" })),
      ...["01", "02", "03", "04", "05", "06", "07", "08"].map((m) => ({ date: `2025-${m}-10`, description: "משכורת חברת בטא" })),
    ];
    const facts = taxYearFacts(rows, months, "2026-11-05");
    expect(facts).toEqual([
      { year: 2024, payers: 2, salaryMonths: 12, fullYear: true },
      { year: 2025, payers: 1, salaryMonths: 8, fullYear: true },
    ]);
    const s = buildSuggestions([], { ...ctx, taxYears: facts }).filter((x) => x.type === "taxRefund");
    expect(s.map((x) => x.type === "taxRefund" && x.reason)).toEqual(["twoEmployers", "gap"]);
  });
});
