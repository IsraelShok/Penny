import { describe, expect, it } from "vitest";
import { buildSuggestions, type SuggestionTxn } from "@/lib/suggestions";

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
});
