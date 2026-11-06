"use client";

import { useLocale, useTranslations } from "next-intl";
import { CardShell } from "@/components/home/card-shell";
import { projectMonthEnd } from "@/lib/budget-suggest";
import { shekels } from "@/lib/money";
import type { DashboardSummary } from "@/lib/types";

/** Planned vs actual for the current month, answer first. */
export function PlanVsActual({ summary }: { summary: DashboardSummary }) {
  const t = useTranslations("budgetPlan");
  const locale = useLocale();
  // Top-level rows only (parents carry their children's rollup), so nothing counts twice.
  const rows = summary.categoriesWithData.filter((c) => c.parentId == null && c.budget > 0);
  if (rows.length === 0) return null;
  const planned = rows.reduce((s, c) => s + c.budget, 0);
  const actual = rows.reduce((s, c) => s + c.spent, 0);
  const expected = projectMonthEnd(actual, summary.timeElapsedPercent);
  const furthest = [...rows].sort((a, b) => Math.abs(b.spent - b.budget) - Math.abs(a.spent - a.budget)).slice(0, 5);
  const figures = [
    { key: "planned", value: planned },
    { key: "actual", value: actual },
    { key: "expected", value: expected },
  ] as const;

  return (
    <CardShell label={t("summaryLabel")}>
      <p className="text-base leading-relaxed">
        {t("sentence", { actual: shekels(actual, locale), planned: shekels(planned, locale), expected: shekels(expected, locale) })}
      </p>
      <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
        {figures.map((f) => (
          <div key={f.key} className="rounded-xl bg-muted/60 p-3">
            <dt className="text-xs text-muted-foreground">{t(f.key)}</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">{shekels(f.value, locale)}</dd>
          </div>
        ))}
      </dl>
      <table className="mt-4 w-full text-sm">
        <caption className="mb-2 text-start text-xs text-muted-foreground">{t("tableCaption")}</caption>
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th scope="col" className="py-1 text-start font-medium">{t("category")}</th>
            <th scope="col" className="py-1 text-end font-medium">{t("planned")}</th>
            <th scope="col" className="py-1 text-end font-medium">{t("actual")}</th>
            <th scope="col" className="py-1 text-end font-medium">{t("difference")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {furthest.map((c) => {
            const diff = c.spent - c.budget;
            return (
              <tr key={c.categoryId}>
                <th scope="row" className="py-2 text-start font-normal">{c.categoryName}</th>
                <td className="py-2 text-end tabular-nums">{shekels(c.budget, locale)}</td>
                <td className="py-2 text-end tabular-nums">{shekels(c.spent, locale)}</td>
                {/* Words, not only color, say which way it went. */}
                <td className={`py-2 text-end tabular-nums ${diff > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                  {diff > 0 ? t("over", { amount: shekels(diff, locale) }) : t("under", { amount: shekels(-diff, locale) })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </CardShell>
  );
}
