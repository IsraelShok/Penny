"use client";

import { WhatIs } from "@/components/help/what-is";
import { CardAction } from "@/components/home/card-shell";
import { useLocale, useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/formatters";
import { shekels } from "@/lib/money";
import { translateCategoryName } from "@/lib/i18n-data";
import type { DashboardSummary } from "@/lib/types";
import type { Locale } from "@/i18n/routing";

interface HeroCardProps {
  data: DashboardSummary | undefined;
  loading: boolean;
  monthLabel: string;
}

type PaceVerdict =
  | "overBudget"
  | "headsUp"
  | "wellUnder"
  | "ahead"
  | "onSchedule"
  | "noBudget";

function computeVerdict(
  budgetedSpent: number,
  totalBudget: number,
  timeElapsedPercent: number,
): PaceVerdict {
  if (totalBudget <= 0) return "noBudget";
  const pctSpent = (budgetedSpent / totalBudget) * 100;
  if (pctSpent > 100) return "overBudget";
  const delta = pctSpent - timeElapsedPercent;
  if (delta >= 25) return "headsUp";
  if (delta <= -25) return "wellUnder";
  if (delta <= -10) return "ahead";
  return "onSchedule";
}

export function HeroCard({ data, loading, monthLabel }: HeroCardProps) {
  const t = useTranslations("dashboard");
  const tCat = useTranslations("categoriesSeeded");
  const locale = useLocale() as Locale;
  // Hooks run before the loading return, so their order never changes between renders.
  const todayPhrase = useTodayPhrase(data?.todayLabel ?? "", locale);

  if (loading || !data) {
    return (
      <div className="rounded-2xl bg-card p-8">
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const {
    periodTotal,
    budgetedSpent,
    totalBudget,
    timeElapsedPercent,
    daysUntilPayday,
    categoriesWithData,
    typicalMonthly,
  } = data;
  const hasBudget = totalBudget > 0;

  const parentIdsWithRollup = new Set(
    categoriesWithData.filter((c) => c.isParent).map((c) => c.categoryId)
  );
  const sorted = [...categoriesWithData]
    .filter(
      (c) =>
        c.spent > 0 &&
        (c.isParent ||
          c.parentId == null ||
          !parentIdsWithRollup.has(c.parentId))
    )
    .sort((a, b) => b.spent - a.spent);
  const topFour = sorted.slice(0, 4);
  const rest = sorted.slice(4);
  const restTotal = rest.reduce((sum, c) => sum + c.spent, 0);
  const grandTotal = sorted.reduce((sum, c) => sum + c.spent, 0);

  const legend = [
    ...topFour.map((c) => ({
      name: translateCategoryName(c.categoryName, tCat),
      color: c.categoryColor,
      amount: c.spent,
      pct: grandTotal > 0 ? (c.spent / grandTotal) * 100 : 0,
    })),
    ...(rest.length > 0
      ? [
          {
            name: t("moreCategories", { count: rest.length }),
            color: "#B1AA9C",
            amount: restTotal,
            pct: grandTotal > 0 ? (restTotal / grandTotal) * 100 : 0,
          },
        ]
      : []),
  ];

  const verdict = computeVerdict(budgetedSpent, totalBudget, timeElapsedPercent);

  const ctaLabel = typicalMonthly
    ? t("setMonthlyTargetWithTypical", {
        amount: formatCurrency(typicalMonthly, "ILS", locale),
      })
    : t("setMonthlyTarget");

  const money = (n: number) => shekels(n, locale);
  const spent = hasBudget ? budgetedSpent : periodTotal;
  const pct = hasBudget ? Math.min(100, (budgetedSpent / totalBudget) * 100) : 0;
  const left = totalBudget - budgetedSpent;
  const forecast = timeElapsedPercent > 5 ? (spent / timeElapsedPercent) * 100 : null;
  const tone = verdict === "overBudget" || verdict === "headsUp" ? "var(--status-heads-up)" : "var(--status-on-track)";
  const word = {
    overBudget: t("wordOverBudget"),
    headsUp: t("wordOverSchedule"),
    wellUnder: t("wordWellUnder"),
    ahead: t("wordAhead"),
    onSchedule: t("wordOnSchedule"),
    noBudget: t("verdictSpentThisMonth"),
  }[verdict];

  return (
    <section className="rounded-2xl bg-card p-6 md:p-8" aria-label={monthLabel}>
      <p className="text-footnote text-muted-foreground">
        {todayPhrase} · {daysUntilPayday} {daysUntilPayday === 1 ? t("daysOne") : t("daysOther")} {t("untilPayday")}
      </p>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="figure text-5xl"><bdi>{money(spent)}</bdi></span>
        {hasBudget && <span className="text-headline text-muted-foreground">{t("ofBudget", { amount: money(totalBudget) })} <WhatIs concept="budget" /></span>}
        <span className="ms-auto rounded-full px-3 py-1 text-footnote font-semibold" style={{ color: tone, backgroundColor: `color-mix(in oklch, ${tone} 12%, transparent)` }}>
          {word}
        </span>
        <WhatIs concept="pace" className="-ms-2" />
      </div>

      {hasBudget && (
        <div className="mt-5">
          <div className="relative h-2.5 rounded-full bg-muted">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: tone }} />
            {/* Where spending would be today at an even pace. */}
            <span className="absolute -top-1 h-[1.125rem] w-0.5 rounded-full bg-foreground/60" style={{ insetInlineStart: `${Math.min(100, timeElapsedPercent)}%` }} aria-hidden />
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <div><dt className="text-muted-foreground">{left >= 0 ? t("heroLeft") : t("heroOver")}</dt><dd className="mt-0.5 font-semibold tabular-nums"><bdi>{money(Math.abs(left))}</bdi></dd></div>
            <div><dt className="text-muted-foreground">{t("heroPerDay")}</dt><dd className="mt-0.5 font-semibold tabular-nums"><bdi>{left > 0 && daysUntilPayday > 0 ? money(left / daysUntilPayday) : "—"}</bdi></dd></div>
            <div><dt className="text-muted-foreground">{t("heroForecast")} <WhatIs concept="forecast" /></dt><dd className="mt-0.5 font-semibold tabular-nums"><bdi>{forecast != null ? money(forecast) : "—"}</bdi></dd></div>
          </dl>
        </div>
      )}

      {legend.length > 0 && (
        <div className="mt-6 space-y-3 border-t border-border/60 pt-5">
          <StackedBar legend={legend} />
          <ul className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {legend.map((seg) => (
              <li key={seg.name} className="flex items-center gap-2">
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: seg.color }} aria-hidden />
                <span className="min-w-0 truncate">{seg.name}</span>
                <span className="ms-auto tabular-nums text-muted-foreground"><bdi>{money(seg.amount)}</bdi></span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!hasBudget && (
        <div className="mt-4">
          <CardAction href="/settings/general#section-monthly-target">{ctaLabel}</CardAction>
        </div>
      )}
    </section>
  );
}

function useTodayPhrase(serverLabel: string, locale: Locale): string {
  // Re-format today's date in the current locale so Hebrew users see Hebrew.
  // The server passed a snapshot, but we re-derive from `new Date()` for the locale.
  try {
    const fmt = new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-IL", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    return fmt.format(new Date());
  } catch {
    return serverLabel;
  }
}



function StackedBar({
  legend,
}: {
  legend: { name: string; color: string; pct: number }[];
}) {
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
      {legend.map((seg, i) => (
        <div
          key={i}
          style={{ width: `${seg.pct}%`, backgroundColor: seg.color }}
        />
      ))}
    </div>
  );
}
