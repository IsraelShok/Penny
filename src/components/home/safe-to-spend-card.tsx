"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { getCashAhead } from "@/lib/api";
import { shekels } from "@/lib/money";
import { cn } from "@/lib/utils";
import { CardShell, CardAction } from "./card-shell";

/** How much is free to spend until the next salary, from the synced bank balance and upcoming card bills. */
export function SafeToSpendCard() {
  const t = useTranslations("cashAhead");
  const locale = useLocale();
  const { data } = useQuery({ queryKey: ["cash-ahead"], queryFn: getCashAhead });
  if (!data) return null;

  if (data.safeToSpend == null) {
    return (
      <CardShell label={t("title")} action={<CardAction href="/settings/bank">{t("connect")}</CardAction>}>
        <p className="text-footnote text-pretty text-muted-foreground">{t("noBalance")}</p>
      </CardShell>
    );
  }
  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(new Date(`${data.until}T12:00:00`));
  return (
    <CardShell label={t("title")}>
      <p className={cn("figure text-[2.25rem] leading-none", data.safeToSpend < 0 && "text-status-over")}>{shekels(data.safeToSpend, locale)}</p>
      <p className="mt-2 text-footnote text-muted-foreground">
        {t("until", { date, days: data.daysLeft })}
        {data.daysLeft > 0 && data.safeToSpend > 0 && <> · {t("perDay", { amount: shekels(data.safeToSpend / data.daysLeft, locale) })}</>}
      </p>
      <dl className="mt-3 space-y-1 text-caption text-muted-foreground">
        <div className="flex justify-between gap-3"><dt>{t("inBank")}</dt><dd className="tabular-nums">{shekels(data.bank ?? 0, locale)}</dd></div>
        <div className="flex justify-between gap-3"><dt>{t("billsDue")}</dt><dd className="tabular-nums">{shekels(-data.billsDue, locale)}</dd></div>
        {data.salaryExpected > 0 && (
          <div className="flex justify-between gap-3"><dt>{t("salaryOn", { date })}</dt><dd className="tabular-nums">{shekels(data.salaryExpected, locale)}</dd></div>
        )}
      </dl>
    </CardShell>
  );
}
