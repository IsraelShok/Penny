"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { getAssets, getCashAhead, getCashflowHealth } from "@/lib/api";
import { usePlan } from "@/hooks/use-plan";
import { useHousehold } from "@/hooks/use-household";
import { buildMoneyMap, type MapRow } from "@/lib/money-map";
import { shekels } from "@/lib/money";
import { Forward } from "@/components/ui/dir-chevron";
import { CardShell, CardSkeleton } from "./card-shell";

/** "Your whole picture": one row per money area; a failed or empty area invites instead of showing a number. */
export function MoneyMap() {
  const t = useTranslations("home.map");
  const locale = useLocale();
  const assets = useQuery({ queryKey: ["assets"], queryFn: getAssets });
  const health = useQuery({ queryKey: ["cashflow-health"], queryFn: getCashflowHealth });
  const cash = useQuery({ queryKey: ["cash-ahead"], queryFn: getCashAhead });
  const { plan } = usePlan();
  const { household, loading } = useHousehold();

  if (assets.isPending || health.isPending || cash.isPending || loading) return <CardSkeleton label={t("title")} height={320} className="mb-6" />;

  const { rows, more } = buildMoneyMap({
    forecast: cash.data?.safeToSpend ?? null,
    assets: assets.data?.assets ?? null,
    expenses: health.data?.hasData ? health.data.avgExpenses : null,
    emergencyMonths: plan.emergencyMonths,
    hasHomeEvent: household.events.some((e) => e.type === "homePurchase" || e.type === "movedIn"),
  });

  const row = (r: MapRow) => {
    const v = r.value == null ? null : Math.round(r.value);
    const text = v == null ? t(`invite.${r.area}`)
      : r.area === "debts" && v === 0 ? t("noDebts")
      : r.area === "cushion" && r.months != null ? t("value.cushionMonths", { amount: shekels(v, locale), months: r.months })
      : r.area === "cashflow" && v < 0 ? t("value.cashflowNegative", { amount: shekels(-v, locale) })
      : r.area === "debts" && r.count ? t("value.debtsCount", { amount: shekels(v, locale), count: r.count })
      : t(`value.${r.area}`, { amount: shekels(v, locale) });
    return (
      <li key={r.area}>
        <Link href={r.href} className="flex min-h-11 items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring">
          <span className="min-w-0 flex-1">
            <span className="block text-footnote font-semibold">{t(`area.${r.area}`)}</span>
            <span className={`block text-footnote ${v == null ? "text-primary" : "text-muted-foreground"}`}>{text}</span>
          </span>
          <Forward className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      </li>
    );
  };

  return (
    <CardShell label={t("title")} className="mb-6 h-auto">
      <ul className="-mx-2 divide-y divide-border/60">{rows.map(row)}</ul>
      {more.length > 0 && (
        <details className="mt-2">
          <summary className="flex min-h-11 cursor-pointer items-center px-0 text-footnote font-medium text-primary">{t("more")}</summary>
          <ul className="-mx-2 divide-y divide-border/60">{more.map(row)}</ul>
        </details>
      )}
    </CardShell>
  );
}
