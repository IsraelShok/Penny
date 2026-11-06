"use client";

import { useQuery } from "@tanstack/react-query";
import { DataState } from "@/components/ui/data-state";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getInsights, listIntegrations, type InsightsPayload } from "@/lib/api";
import { shekels } from "@/lib/money";
import { BalanceForecastCard } from "./balance-forecast-card";
import { RecurringCalendar } from "./recurring-calendar";
import { OverdraftCard } from "./overdraft-card";
import { More } from "@/components/overview/more";

const PER_MONTH = { weekly: 52 / 12, monthly: 1, yearly: 1 / 12 } as const;


/** One tab of the insights: what's coming ("ahead") or what repeats ("recurring"). */
export function InsightsView({ part }: { part: "ahead" | "recurring" }) {
  const t = useTranslations("insights");
  const locale = useLocale();
  const money = (n: number) => shekels(Math.round(n), locale);
  const query = useQuery({ queryKey: ["insights"], queryFn: getInsights });
  const banks = useQuery({ queryKey: ["integrations"], queryFn: listIntegrations });
  const data = query.data;
  if (query.isError || banks.isError) return <DataState error onRetry={() => { void query.refetch(); void banks.refetch(); }} />;
  if (!data || banks.isPending) return <DataState loading />;
  if (!banks.data?.some((bank) => bank.lastSyncAt) && data.forecast.length === 0 && data.series.length === 0 && data.installments.plans.length === 0) return <DataState />;

  if (part === "recurring") return (
    <div className="grid gap-6">
      <Subscriptions data={data} money={money} />
      {data.installments.plans.length > 0 && <OpenInstallments data={data.installments} locale={locale} />}
    </div>
  );

  return (
    <div className="grid gap-6">
      <BalanceForecastCard />
      <RecurringCalendar data={data} today={new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date())} />
      <Card>
        <CardHeader>
          <CardTitle>{t("forecast")}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.forecast.length === 0 && <p className="text-sm leading-relaxed text-muted-foreground">{t("noForecast")}</p>}
          <ul className="grid gap-3">
            {data.forecast.map((f) => (
              <li key={`${f.account}|${f.date}`} className="flex flex-wrap items-baseline justify-between gap-x-4">
                <span className="tabular-nums" dir="ltr">
                  {f.date} · {t("card")} {f.account?.slice(-4)}
                </span>
                <span className="text-lg font-semibold tabular-nums">{money(f.total)}</span>
                <span className="w-full text-sm text-muted-foreground">
                  {t("posted")} {money(f.parts.posted)} · {t("recurring")} {money(f.parts.recurring)} · {t("installments")} {money(f.parts.installments)} · {t("other")} {money(f.parts.discretionary)}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <OverdraftCard
        subscriptionsMonthly={data.series.filter((s) => s.status !== "candidate").reduce((sum, s) => sum + s.expectedAmount * PER_MONTH[s.cadence], 0)}
      />

      <More>
      <Card>
        <CardHeader>
          <CardTitle>{t("anomalies")}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.anomalies.length === 0 ? (
            <p className="text-muted-foreground">{t("noAnomalies")}</p>
          ) : (
            <ul className="grid gap-2">
              {data.anomalies.map((a, i) => (
                <li key={i}>{a.detail}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      </More>
    </div>
  );
}

/** What is still owed on installment purchases, how it runs off over the next year, and each plan. */
function OpenInstallments({ data, locale }: { data: InsightsPayload["installments"]; locale: string }) {
  const t = useTranslations("insights");
  const peak = Math.max(...data.months.map((m) => m.total), 1);
  const monthName = new Intl.DateTimeFormat(locale, { month: "short" });
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("openInstallments")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5">
        <p>
          <span className="block text-sm text-muted-foreground">{t("stillOwed")}</span>
          <span className="text-2xl font-semibold tabular-nums">{shekels(data.total, locale)}</span>
        </p>
        <ul className="flex h-24 items-end gap-1" aria-label={t("runoff")}>
          {data.months.map((m) => {
            const label = monthName.format(new Date(`${m.month}-15T12:00:00`));
            return (
              <li key={m.month} className="flex h-full flex-1 flex-col items-center gap-1" title={`${label}: ${shekels(m.total, locale)}`}>
                <span className="flex w-full flex-1 items-end" aria-hidden>
                  <span className="w-full rounded-t-sm bg-primary/70" style={{ height: `${(m.total / peak) * 100}%` }} />
                </span>
                <span className="text-xs text-muted-foreground" aria-hidden>{label}</span>
                <span className="sr-only">{label}: {shekels(m.total, locale)}</span>
              </li>
            );
          })}
        </ul>
        <ul className="grid gap-3">
          {data.plans.map((p) => (
            <li key={`${p.account}|${p.merchant}|${p.amount}|${p.total}`} className="flex flex-wrap items-baseline justify-between gap-x-4">
              <span className="font-medium">{p.merchant}</span>
              <span className="tabular-nums">{shekels(p.remaining, locale)}</span>
              <span className="w-full text-sm text-muted-foreground tabular-nums">
                {t("paidOf", { paid: p.paid, total: p.total, amount: shekels(p.amount, locale) })}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function Subscriptions({ data, money }: { data: InsightsPayload; money: (n: number) => string }) {
  const t = useTranslations("insights");
  return (
    <Card id="subscriptions" className="scroll-mt-20">
      <CardHeader>
        <CardTitle>{t("subscriptions")}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.series.length === 0 ? (
          <p className="text-muted-foreground">{t("noSubscriptions")}</p>
        ) : (
          <ul className="grid gap-3">
            {data.series.map((s) => (
              <li key={`${s.merchant}|${s.currency}`} className="flex flex-wrap items-baseline justify-between gap-x-4">
                <span className="font-medium">
                  {s.merchant}
                  {s.status === "candidate" ? <span className="ms-2 text-sm text-muted-foreground">({t("maybe")})</span> : null}
                </span>
                <span className="tabular-nums">
                  {money(s.expectedAmount)} · {t(s.cadence)}
                </span>
                {s.priceChange ? (
                  <span className="w-full text-sm text-[var(--status-heads-up)]">
                    {t("priceChanged", { from: money(s.priceChange.from), to: money(s.priceChange.to) })}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
