"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, CircleDot, Printer } from "lucide-react";
import { getOverview } from "@/lib/api";
import { ICON_MAP } from "@/components/dashboard/category-card";
import { CardShell } from "@/components/home/card-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { translateCategoryName } from "@/lib/i18n-data";
import { cn } from "@/lib/utils";
import type { PeriodKind } from "@/lib/period";
import type { CostType, NeedType, OverviewPayload, OverviewTotals } from "@/lib/types";

const KINDS: PeriodKind[] = ["month", "quarter", "half", "year"];
const NEED_COLORS: Record<NeedType, string> = { need: "var(--chart-1)", want: "var(--chart-2)", saving: "var(--chart-3)" };
const COST_COLORS: Record<CostType, string> = { fixed: "var(--chart-1)", variable: "var(--chart-4)", unplanned: "var(--chart-5)" };

const fmt = (n: number, locale: string) =>
  Math.round(n).toLocaleString(locale === "he" ? "he-IL" : "en-US");
// LTR isolate keeps the sign in front of the amount inside Hebrew text.
const shekels = (n: number, locale: string) => `⁦${n < 0 ? "−" : ""}₪${fmt(Math.abs(n), locale)}⁩`;
const pct = (n: number) => `${Math.round(n * 100)}%`;

export function OverviewView() {
  const t = useTranslations("overview");
  const [kind, setKind] = useState<PeriodKind>("quarter");
  const [offset, setOffset] = useState(0);
  const query = useQuery({
    queryKey: ["overview", kind, offset],
    queryFn: () => getOverview(kind, offset),
  });

  return (
    <div className="space-y-4 md:space-y-6">
      {query.data && (
        <div className="hidden print:block">
          <p className="text-title font-semibold">{t("reportTitle")} · <PeriodLabel period={query.data.period} /></p>
          <p className="text-caption">{t("reportGenerated", { date: new Date().toLocaleDateString() })}</p>
        </div>
      )}
      <div className="print-hidden flex flex-wrap items-center justify-between gap-3">
        <div role="radiogroup" aria-label={t("periodPicker")} className="inline-flex rounded-xl bg-muted p-1">
          {KINDS.map((k) => (
            <button
              key={k}
              role="radio"
              aria-checked={kind === k}
              onClick={() => {
                setKind(k);
                setOffset(0);
              }}
              className={cn(
                "min-h-9 rounded-lg px-3 text-footnote font-medium transition-colors",
                kind === k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t(`period_${k}`)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label={t("prev")} onClick={() => setOffset((o) => o + 1)}>
            <ChevronRight className="size-4 rtl:hidden" aria-hidden />
            <ChevronLeft className="hidden size-4 rtl:block" aria-hidden />
          </Button>
          <span className="min-w-28 text-center text-headline font-semibold tabular-nums" aria-live="polite">
            {query.data ? <PeriodLabel period={query.data.period} /> : "…"}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("next")}
            disabled={offset === 0}
            onClick={() => setOffset((o) => Math.max(0, o - 1))}
          >
            <ChevronLeft className="size-4 rtl:hidden" aria-hidden />
            <ChevronRight className="hidden size-4 rtl:block" aria-hidden />
          </Button>
          <Button variant="outline" className="ms-2" onClick={() => window.print()} disabled={!query.data}>
            <Printer className="size-4" aria-hidden />
            {t("print")}
          </Button>
        </div>
      </div>

      {query.isError ? (
        <CardShell>
          <p className="text-footnote text-muted-foreground">{t("error")}</p>
          <Button variant="outline" className="mt-3 self-start" onClick={() => query.refetch()}>
            {t("retry")}
          </Button>
        </CardShell>
      ) : !query.data ? (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
          <Skeleton className="h-64 rounded-2xl md:col-span-4" />
        </div>
      ) : (
        <Body data={query.data} />
      )}
    </div>
  );
}

function PeriodLabel({ period }: { period: OverviewPayload["period"] }) {
  const t = useTranslations("overview");
  const locale = useLocale();
  const n = Math.floor((period.startMonth - 1) / (period.kind === "half" ? 6 : 3)) + 1;
  const month = new Intl.DateTimeFormat(locale, { month: "long" }).format(new Date(period.year, period.startMonth - 1, 1));
  return <>{t(`label_${period.kind}`, { month, year: period.year, n })}</>;
}

function Body({ data }: { data: OverviewPayload }) {
  const t = useTranslations("overview");
  const locale = useLocale();
  const empty = data.totals.income === 0 && data.totals.expenses === 0;
  // Future and not-yet-synced months would drag the average down.
  const avgMonthly = data.totals.expenses / Math.max(1, data.monthly.filter((m) => m.expenses > 0).length);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("income")} value={shekels(data.totals.income, locale)} cur={data.totals.income} prev={data.previous.income} ly={data.lastYear.income} goodWhenUp />
        <Stat label={t("expenses")} value={shekels(data.totals.expenses, locale)} cur={data.totals.expenses} prev={data.previous.expenses} ly={data.lastYear.expenses} />
        <Stat label={t("net")} value={shekels(data.totals.net, locale)} cur={data.totals.net} prev={data.previous.net} ly={data.lastYear.net} goodWhenUp tone={data.totals.net < 0 ? "bad" : undefined} />
        <SavingsStat totals={data.totals} previous={data.previous} lastYear={data.lastYear} />
      </div>

      {empty ? (
        <CardShell><p className="text-footnote text-muted-foreground">{t("empty")}</p></CardShell>
      ) : (
        <>
          {data.monthly.length > 1 && <FlowChart monthly={data.monthly} />}

          <div className="grid gap-4 md:grid-cols-2">
            <SplitCard
              title={t("ruleTitle")}
              hint={t("ruleHint")}
              parts={(["need", "want", "saving"] as const).map((k) => ({ key: k, label: t(k), value: data.byNeed[k], color: NEED_COLORS[k] }))}
              uncategorized={data.uncategorized}
            />
            <SplitCard
              title={t("costTitle")}
              parts={(["fixed", "variable", "unplanned"] as const).map((k) => ({ key: k, label: t(k), value: data.byCost[k], color: COST_COLORS[k] }))}
              uncategorized={data.uncategorized}
            />
          </div>

          <CategoryList data={data} />
          {data.period.months.length > 1 && <YearTable data={data} />}

          <p className="px-1 text-footnote text-muted-foreground" title={t("lifeCostHint")}>
            <span className="font-medium text-foreground">{t("lifeCost", { amount: fmt(avgMonthly * 300, locale) })}</span>
            {" · "}
            {t("lifeCostHint")}
          </p>
        </>
      )}
    </>
  );
}

function Delta({ cur, base, goodWhenUp, label }: { cur: number; base: number; goodWhenUp?: boolean; label: string }) {
  if (base === 0) return null;
  const change = (cur - base) / Math.abs(base);
  const good = goodWhenUp ? change >= 0 : change <= 0;
  return (
    <span className="flex items-baseline gap-1.5 text-caption">
      <span className={cn("font-semibold tabular-nums", good ? "text-status-on-track" : "text-status-over")} dir="ltr">
        {change >= 0 ? "+" : "−"}{pct(Math.abs(change))}
      </span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

function Stat({
  label, value, cur, prev, ly, goodWhenUp, tone,
}: { label: string; value: string; cur: number; prev: number; ly: number; goodWhenUp?: boolean; tone?: "bad" }) {
  const t = useTranslations("overview");
  return (
    <CardShell label={label}>
      <p className={cn("figure text-[2rem] leading-tight", tone === "bad" && "text-status-over")}>{value}</p>
      <div className="mt-2 space-y-0.5">
        <Delta cur={cur} base={prev} goodWhenUp={goodWhenUp} label={t("vsPrevShort")} />
        <Delta cur={cur} base={ly} goodWhenUp={goodWhenUp} label={t("vsLyShort")} />
      </div>
    </CardShell>
  );
}

function SavingsStat({ totals, previous, lastYear }: { totals: OverviewTotals; previous: OverviewTotals; lastYear: OverviewTotals }) {
  const t = useTranslations("overview");
  const rate = totals.savingsRate;
  const points = (base: number | null, label: string) =>
    rate != null && base != null ? (
      <span className="flex items-baseline gap-1.5 text-caption">
        <span className={cn("whitespace-nowrap font-semibold tabular-nums", rate >= base ? "text-status-on-track" : "text-status-over")}>
          <bdi>{rate >= base ? "+" : "−"}{Math.round(Math.abs(rate - base) * 100)}</bdi> {t("points")}
        </span>
        <span className="text-muted-foreground">{label}</span>
      </span>
    ) : null;
  return (
    <CardShell label={t("savingsRate")}>
      <p className={cn("figure text-[2rem] leading-tight", rate != null && rate < 0 && "text-status-over")} dir="ltr">
        {rate == null ? "—" : pct(rate)}
      </p>
      {rate == null ? (
        <p className="mt-2 text-caption text-muted-foreground">{t("noIncome")}</p>
      ) : (
        <div className="mt-2 space-y-0.5">
          {points(previous.savingsRate, t("vsPrevShort"))}
          {points(lastYear.savingsRate, t("vsLyShort"))}
        </div>
      )}
    </CardShell>
  );
}

function FlowChart({ monthly }: { monthly: OverviewPayload["monthly"] }) {
  const t = useTranslations("overview");
  const locale = useLocale();
  const max = Math.max(1, ...monthly.flatMap((m) => [m.income, m.expenses]));
  const monthLabel = (key: string) =>
    new Intl.DateTimeFormat(locale, { month: "short" }).format(new Date(`${key}-15T12:00:00`));

  return (
    <CardShell
      label={t("cashFlowTitle")}
      action={
        <span className="flex items-center gap-3 text-caption text-muted-foreground">
          <Legend color="var(--chart-1)" label={t("income")} />
          <Legend color="var(--chart-2)" label={t("expenses")} />
        </span>
      }
    >
      {/* Time runs right to left in Hebrew, like the rest of the page. */}
      <ul className="flex h-44 items-end gap-2 sm:gap-3" aria-label={t("cashFlowChart")}>
        {monthly.map((m) => (
          <li key={m.month} className="flex h-full min-w-0 flex-1 flex-col items-center gap-1.5">
            <span className="sr-only">
              {monthLabel(m.month)}: {t("income")} {shekels(m.income, locale)}, {t("expenses")} {shekels(m.expenses, locale)}
            </span>
            <div className="flex w-full flex-1 items-end justify-center gap-0.5 sm:gap-1" aria-hidden>
              <span className="w-full max-w-4 rounded-t-sm bg-chart-1" style={{ height: `${(m.income / max) * 100}%` }} />
              <span className="w-full max-w-4 rounded-t-sm bg-chart-2" style={{ height: `${(m.expenses / max) * 100}%` }} />
            </div>
            <span className="truncate text-caption text-muted-foreground" aria-hidden>{monthLabel(m.month)}</span>
          </li>
        ))}
      </ul>
    </CardShell>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="size-2 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      {label}
    </span>
  );
}

function SplitCard({
  title, hint, parts, uncategorized,
}: {
  title: string;
  hint?: string;
  parts: { key: string; label: string; value: number; color: string }[];
  uncategorized: number;
}) {
  const t = useTranslations("overview");
  const locale = useLocale();
  const total = parts.reduce((s, p) => s + p.value, 0);
  return (
    <CardShell label={title}>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
        {parts.map((p) =>
          p.value > 0 ? <span key={p.key} style={{ width: `${(p.value / Math.max(total, 1)) * 100}%`, backgroundColor: p.color }} /> : null
        )}
      </div>
      <ul className="mt-4 space-y-2">
        {parts.map((p) => (
          <li key={p.key} className="flex items-baseline justify-between gap-3 text-footnote">
            <Legend color={p.color} label={p.label} />
            <span className="tabular-nums">
              <span className="font-semibold">{total ? pct(p.value / total) : "—"}</span>
              <span className="ms-2 text-muted-foreground">{shekels(p.value, locale)}</span>
            </span>
          </li>
        ))}
      </ul>
      {uncategorized > 0 && (
        <p className="mt-3 text-caption text-muted-foreground">{t("uncategorized", { amount: fmt(uncategorized, locale) })}</p>
      )}
      {hint && <p className="mt-3 text-caption text-pretty text-muted-foreground">{hint}</p>}
    </CardShell>
  );
}

function CategoryList({ data }: { data: OverviewPayload }) {
  const t = useTranslations("overview");
  const tCat = useTranslations("categoriesSeeded");
  const locale = useLocale();
  const total = data.categories.reduce((s, c) => s + c.spent, 0);

  return (
    <CardShell label={t("categoriesTitle")}>
      <ul className="divide-y divide-border">
        {data.categories.map((c) => {
          const Icon = ICON_MAP[c.icon ?? "circle-dot"] ?? CircleDot;
          return (
            <li key={c.categoryId} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-3">
              <span
                className="grid size-9 place-items-center rounded-xl"
                style={{ backgroundColor: `color-mix(in oklab, ${c.color} 22%, transparent)` }}
                aria-hidden
              >
                <Icon className="size-[18px] text-foreground" />
              </span>
              <div className="min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-footnote font-medium">{translateCategoryName(c.name, tCat)}</span>
                  <span className="shrink-0 text-caption text-muted-foreground tabular-nums">{total ? pct(c.spent / total) : ""}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div className="h-full rounded-full" style={{ width: `${total ? (c.spent / total) * 100 : 0}%`, backgroundColor: c.color }} />
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3">
                  <Delta cur={c.spent} base={c.previous} label={t("vsPrevShort")} />
                  <Delta cur={c.spent} base={c.lastYear} label={t("vsLyShort")} />
                </div>
              </div>
              <span className="text-footnote font-semibold tabular-nums">{shekels(c.spent, locale)}</span>
            </li>
          );
        })}
      </ul>
    </CardShell>
  );
}

function YearTable({ data }: { data: OverviewPayload }) {
  const t = useTranslations("overview");
  const tCat = useTranslations("categoriesSeeded");
  const locale = useLocale();
  const monthLabel = (key: string) =>
    new Intl.DateTimeFormat(locale, { month: "short" }).format(new Date(`${key}-15T12:00:00`));
  const colTotal = (m: string) => data.categories.reduce((s, c) => s + (c.monthly[m] ?? 0), 0);

  return (
    <CardShell label={t("tableTitle")} className="p-0 md:p-0">
      <div className="overflow-x-auto px-5 pb-5 md:px-6 md:pb-6" tabIndex={0} role="region" aria-label={t("tableCaption")}>
        <table className="w-full min-w-max text-footnote tabular-nums">
          <caption className="sr-only">{t("tableCaption")}</caption>
          <thead>
            <tr className="text-caption text-muted-foreground">
              <th scope="col" className="sticky start-0 bg-card py-2 pe-4 text-start font-medium">{t("category")}</th>
              {data.period.months.map((m) => (
                <th key={m} scope="col" className="px-2 py-2 text-end font-medium">{monthLabel(m)}</th>
              ))}
              <th scope="col" className="ps-3 py-2 text-end font-semibold text-foreground">{t("total")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.categories.map((c) => (
              <tr key={c.categoryId}>
                <th scope="row" className="sticky start-0 bg-card py-2 pe-4 text-start font-medium">
                  <span className="flex items-center gap-2">
                    <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: c.color }} aria-hidden />
                    {translateCategoryName(c.name, tCat)}
                  </span>
                </th>
                {data.period.months.map((m) => (
                  <td key={m} className={cn("px-2 py-2 text-end", !c.monthly[m] && "text-muted-foreground")}>
                    {c.monthly[m] ? fmt(c.monthly[m], locale) : "–"}
                  </td>
                ))}
                <td className="ps-3 py-2 text-end font-semibold">{fmt(c.spent, locale)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border font-semibold">
              <th scope="row" className="sticky start-0 bg-card py-2 pe-4 text-start">{t("total")}</th>
              {data.period.months.map((m) => (
                <td key={m} className="px-2 py-2 text-end">{fmt(colTotal(m), locale)}</td>
              ))}
              <td className="ps-3 py-2 text-end">{fmt(data.categories.reduce((s, c) => s + c.spent, 0), locale)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </CardShell>
  );
}
