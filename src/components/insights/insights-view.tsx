"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getInsights, type InsightsPayload } from "@/lib/api";
import { shekels } from "@/lib/money";

const money = (n: number) => `₪${Math.round(n).toLocaleString("en-US")}`;

export function InsightsView() {
  const t = useTranslations("insights");
  const locale = useLocale();
  const [data, setData] = useState<InsightsPayload | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    getInsights().then(setData).catch(() => setFailed(true));
  }, []);

  if (failed) return <p role="alert">{t("couldntLoad")}</p>;
  if (!data) return null;

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("forecast")}</CardTitle>
        </CardHeader>
        <CardContent>
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

      {data.installments.plans.length > 0 && <OpenInstallments data={data.installments} locale={locale} />}

      <Card>
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
                <span className="text-[10px] text-muted-foreground" aria-hidden>{label}</span>
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
