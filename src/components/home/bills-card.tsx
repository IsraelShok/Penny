"use client";

import { useLocale, useTranslations } from "next-intl";
import { shekels } from "@/lib/money";
import { CreditCard, Repeat } from "lucide-react";
import { CardShell, CardAction } from "./card-shell";
import type { InsightsPayload } from "@/lib/api";


const monthly = (s: InsightsPayload["series"][number]) =>
  s.cadence === "weekly" ? s.expectedAmount * 4.33 : s.cadence === "yearly" ? s.expectedAmount / 12 : s.expectedAmount;

/** The soonest card bill (all cards billed that day), from the insights forecast. */
export function NextBillCard({ data }: { data: InsightsPayload }) {
  const t = useTranslations("home");
  const tIns = useTranslations("insights");
  const locale = useLocale();
  const first = [...data.forecast].sort((a, b) => a.date.localeCompare(b.date))[0];
  const sameDay = first ? data.forecast.filter((f) => f.date === first.date) : [];
  const total = sameDay.reduce((s, f) => s + f.total, 0);

  return (
    <CardShell label={t("nextBill")} action={<CardAction href="/insights">{tIns("title")}</CardAction>}>
      {first ? (
        <div className="flex items-center gap-3">
          <IconTile><CreditCard className="size-5" aria-hidden /></IconTile>
          <div className="min-w-0">
            <p className="figure text-[1.75rem] leading-tight">{shekels(total, locale)}</p>
            <p className="text-footnote text-pretty text-muted-foreground">
              {t("nextBillDetail", {
                card: sameDay.map((f) => f.account?.slice(-4)).filter(Boolean).join(", "),
                date: new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(new Date(`${first.date}T12:00:00`)),
              })}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-footnote text-muted-foreground">{t("noUpcomingBills")}</p>
      )}
    </CardShell>
  );
}

export function SubscriptionsCard({ data }: { data: InsightsPayload }) {
  const t = useTranslations("home");
  const tIns = useTranslations("insights");
  const locale = useLocale();
  const active = data.series.filter((s) => s.status === "suggested");
  const total = active.reduce((s, x) => s + monthly(x), 0);

  return (
    <CardShell label={t("subscriptionsTitle")} action={<CardAction href="/insights">{tIns("title")}</CardAction>}>
      {active.length ? (
        <div className="flex items-center gap-3">
          <IconTile><Repeat className="size-5" aria-hidden /></IconTile>
          <div className="min-w-0">
            <p className="figure text-[1.75rem] leading-tight">{shekels(total, locale)}</p>
            <p className="text-footnote text-pretty text-muted-foreground">
              {t("subscriptionsDetail", { count: active.length })}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-footnote text-muted-foreground">{t("noSubscriptions")}</p>
      )}
    </CardShell>
  );
}

function IconTile({ children }: { children: React.ReactNode }) {
  return (
    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
      {children}
    </span>
  );
}
