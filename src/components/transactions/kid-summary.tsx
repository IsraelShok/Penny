"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { DataState } from "@/components/ui/data-state";
import { getChildReport } from "@/lib/api";
import { shekels } from "@/lib/money";

/** One child's month and year, top categories and this month's transactions (owner = that child). */
export function KidSummary({ member, month }: { member: string; month: string }) {
  const t = useTranslations("kids");
  const locale = useLocale();
  const money = (n: number) => shekels(Math.round(n), locale);
  const q = useQuery({ queryKey: ["kid", member, month], queryFn: () => getChildReport(member, month) });
  if (q.isError) return <DataState error onRetry={() => void q.refetch()} />;
  if (q.isPending) return <DataState loading />;
  const { child, summary, transactions } = q.data;
  const age = child.birthYear ? new Date().getFullYear() - child.birthYear : null;
  return (
    <section aria-label={child.name} className="rounded-2xl border border-border/60 bg-card p-4">
      <h3 className="text-base font-semibold">{child.name}{age != null && <span className="ms-2 text-sm font-normal text-muted-foreground">{t("age", { age })}</span>}</h3>
      <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
        <div><dt className="text-xs text-muted-foreground">{t("thisMonth")}</dt><dd className="text-lg font-semibold tabular-nums">{money(summary.month)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">{t("thisYear")}</dt><dd className="text-lg font-semibold tabular-nums">{money(summary.year)}</dd></div>
      </dl>
      {summary.top.length > 0 && (
        <p className="mt-2 text-sm">{t("top")}: {summary.top.map((c) => `${c.category ?? t("uncategorized")} ${money(c.total)}`).join(" · ")}</p>
      )}
      {transactions.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{t("empty")}</p> : (
        <ul className="mt-3 grid gap-1 text-sm">
          {transactions.map((x) => (
            <li key={x.id} className="flex justify-between gap-3">
              <span className="truncate"><span className="tabular-nums text-xs text-muted-foreground" dir="ltr">{x.date.slice(0, 10)}</span> {x.description}</span>
              <span className="tabular-nums">{money(-x.amount)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted-foreground">{t("hint")}</p>
    </section>
  );
}
