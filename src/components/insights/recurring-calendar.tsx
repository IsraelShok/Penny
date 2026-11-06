"use client";

import { useLocale, useTranslations } from "next-intl";
import { CardShell } from "@/components/home/card-shell";
import type { InsightsPayload } from "@/lib/api";
import { addDays, chargesBetween, monthDay, nthCharge } from "@/lib/balance-forecast";
import { shekels } from "@/lib/money";

interface Item { name: string; amount: number; flag?: "late" | "up" }

const OVERDUE_DAYS = 5;

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
  const lead = new Date(`${first}T12:00:00Z`).getUTCDay();
  const days = Number(last.slice(8));
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  const longDay = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", timeZone: "UTC" });
  const money = (n: number) => shekels(Math.round(n), locale);
  const flagText = (f?: Item["flag"]) => (f === "late" ? t("late") : f === "up" ? t("pricierUp") : "");

  return (
    <CardShell label={t("calendarTitle")}>
      <p className="text-base font-medium">{t("calendarSummary", { count })}</p>
      {late.length > 0 && <p className="mt-1 text-sm text-[var(--status-heads-up)]">{t("lateSummary", { names: late.join(", ") })}</p>}
      <div className="mt-3 grid grid-cols-7 gap-1 text-xs">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="pb-1 text-center font-medium text-muted-foreground" aria-hidden>
            {/* 1 Nov 2026 is a Sunday. */}
            {weekday.format(new Date(Date.UTC(2026, 10, 1 + i, 12)))}
          </div>
        ))}
        {Array.from({ length: lead }, (_, i) => <div key={`pad${i}`} aria-hidden />)}
        {Array.from({ length: days }, (_, i) => {
          const d = monthDay(y, m - 1, i + 1);
          const items = byDay.get(d) ?? [];
          const label = items.length
            ? `${longDay.format(new Date(`${d}T12:00:00Z`))}: ${items.map((it) => `${it.name} ${money(it.amount)} ${flagText(it.flag)}`.trim()).join(", ")}`
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
                  <li key={k} className="min-w-0">
                    <span className="block truncate">{it.flag === "late" ? "⚠ " : it.flag === "up" ? "↑ " : ""}{it.name}</span>
                    <span className="block tabular-nums text-muted-foreground">{money(it.amount)}</span>
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
