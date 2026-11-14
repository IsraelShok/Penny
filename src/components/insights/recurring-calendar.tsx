"use client";

import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, TrendingUp } from "lucide-react";
import { CardShell } from "@/components/home/card-shell";
import type { InsightsPayload } from "@/lib/api";
import { addDays, chargesBetween, monthDay, nthCharge, sizeTier } from "@/lib/balance-forecast";
import { shekels } from "@/lib/money";

interface Item { name: string; amount: number; flag?: "late" | "up" }

const OVERDUE_DAYS = 5;
const SIZES = ["small", "medium", "large"] as const;
/** One hue, light to strong, by the charge's size within the month; the size is also in words for screen readers. */
const TIER_EDGE = ["color-mix(in oklab, var(--chart-1) 30%, var(--card))", "color-mix(in oklab, var(--chart-1) 60%, var(--card))", "var(--chart-1)"];
const TIER_BG = ["color-mix(in oklab, var(--chart-1) 6%, transparent)", "color-mix(in oklab, var(--chart-1) 14%, transparent)", "color-mix(in oklab, var(--chart-1) 24%, transparent)"];

/** This month's expected recurring charges and card bills on a Sunday-first grid (RTL flows it right to left). */
export function RecurringCalendar({ data, today }: { data: InsightsPayload; today: string }) {
  const t = useTranslations("ahead");
  const locale = useLocale();
  const [y, m] = today.split("-").map(Number);
  const first = monthDay(y, m - 1, 1);
  const last = monthDay(y, m - 1, 31);
  const byDay = new Map<string, Item[]>();
  const put = (d: string, item: Item) => byDay.set(d, [...(byDay.get(d) ?? []), item]);

  const late: string[] = [];
  for (const s of data.series) {
    const next = nthCharge(s.cadence, s.lastDate, 1);
    const isLate = next < addDays(today, -OVERDUE_DAYS);
    if (isLate) late.push(s.merchant);
    for (const d of chargesBetween(s.cadence, s.lastDate, first, last)) {
      put(d, { name: s.merchant, amount: s.expectedAmount, flag: isLate && d === next ? "late" : s.priceChange ? "up" : undefined });
    }
  }
  for (const b of data.forecast) {
    if (b.date >= first && b.date <= last) put(b.date, { name: t("cardBill", { last4: b.account?.slice(-4) ?? "" }), amount: b.total });
  }

  const count = [...byDay.values()].reduce((n, items) => n + items.length, 0);
  const tier = sizeTier([...byDay.values()].flat().map((it) => it.amount));
  const lead = new Date(`${first}T12:00:00Z`).getUTCDay();
  const days = Number(last.slice(8));
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  const narrowDay = new Intl.DateTimeFormat(locale, { weekday: "narrow", timeZone: "UTC" });
  const longDay = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", timeZone: "UTC" });
  const money = (n: number) => shekels(Math.round(n), locale);
  const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });
  const flagText = (f?: Item["flag"]) => (f === "late" ? t("late") : f === "up" ? t("pricierUp") : "");

  return (
    <CardShell label={t("calendarTitle")}>
      <p className="text-base font-medium">{t("calendarSummary", { count })}</p>
      {late.length > 0 && <p className="mt-1 text-sm text-[var(--status-heads-up)]">{t("lateSummary", { names: late.join(", ") })}</p>}
      {count > 1 && (
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground">
          {SIZES.map((sz, i) => (
            <span key={sz} className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm border-s-[3px]" style={{ borderColor: TIER_EDGE[i], backgroundColor: TIER_BG[i] }} aria-hidden />
              {t(`size_${sz}`)}
            </span>
          ))}
        </p>
      )}
      <div className="mt-3 grid grid-cols-7 gap-1 text-xs">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="pb-1 text-center font-medium text-muted-foreground" aria-hidden>
            {/* 1 Nov 2026 is a Sunday. */}
            {/* Phones: one letter per day, so seven columns fit. */}
            <span className="sm:hidden">{narrowDay.format(new Date(Date.UTC(2026, 10, 1 + i, 12)))}</span>
            <span className="max-sm:hidden">{weekday.format(new Date(Date.UTC(2026, 10, 1 + i, 12)))}</span>
          </div>
        ))}
        {Array.from({ length: lead }, (_, i) => <div key={`pad${i}`} aria-hidden />)}
        {Array.from({ length: days }, (_, i) => {
          const d = monthDay(y, m - 1, i + 1);
          const items = byDay.get(d) ?? [];
          const label = items.length
            ? `${longDay.format(new Date(`${d}T12:00:00Z`))}: ${items.map((it) => `${it.name} ${money(it.amount)} (${t(`size_${SIZES[tier(it.amount)]}`)}) ${flagText(it.flag)}`.trim()).join(", ")}`
            : undefined;
          return (
            <div
              key={d}
              tabIndex={items.length ? 0 : undefined}
              role={items.length ? "group" : undefined}
              aria-label={label}
              aria-hidden={items.length ? undefined : true}
              className={`min-h-14 min-w-0 rounded-lg p-1 focus-visible:outline-2 focus-visible:outline-ring ${d === today ? "bg-primary/10" : items.length ? "bg-muted/60" : ""}`}
            >
              <div className={`tabular-nums ${d === today ? "font-semibold text-primary" : "text-muted-foreground"}`} aria-hidden>{i + 1}</div>
              <ul aria-hidden className="grid gap-0.5">
                {items.map((it, k) => (
                  <li key={k} className="min-w-0 rounded-sm border-s-[3px] ps-0.5" style={{ borderColor: TIER_EDGE[tier(it.amount)], backgroundColor: TIER_BG[tier(it.amount)] }}>
                    <span className="flex min-w-0 items-center gap-0.5">{it.flag === "late" ? <AlertTriangle className="size-3.5 shrink-0" aria-hidden /> : it.flag === "up" ? <TrendingUp className="size-3.5 shrink-0" aria-hidden /> : null}<span className="truncate">{it.name}</span></span>
                    {/* Phones: a compact figure (1.3K) fits the narrow day; the full amount is in the day's label. */}
                    <span className="block tabular-nums text-muted-foreground"><bdi className="sm:hidden">{compact.format(Math.round(it.amount))}</bdi><bdi className="max-sm:hidden">{money(it.amount)}</bdi></span>
                    {it.flag && <span className="block text-[var(--status-heads-up)]">{flagText(it.flag)}</span>}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </CardShell>
  );
}
