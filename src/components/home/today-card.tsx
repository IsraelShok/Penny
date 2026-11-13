"use client";

import { WhatIs } from "@/components/help/what-is";
import { Forward } from "@/components/ui/dir-chevron";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { getCashAhead, getSuggestions, getWellbeing } from "@/lib/api";
import { wellbeingDue } from "@/lib/wellbeing";
import { isoWeek } from "@/lib/plan";
import { todayState } from "@/lib/today-state";
import { lastCompleteMonth } from "@/lib/recap";
import { shekels } from "@/lib/money";
import { usePlan } from "@/hooks/use-plan";
import { useGentle } from "@/hooks/use-gentle";
import { gentleKey } from "@/lib/gentle";
import { cn } from "@/lib/utils";
import type { HomePayload } from "@/lib/types";
import type { BillForecast } from "@/server/insights/forecast";

export function TodayCard({ home, bills, homePending, homeFailed, onRetry }: {
  home: HomePayload | undefined;
  bills: BillForecast[] | undefined;
  homePending: boolean;
  homeFailed: boolean;
  onRetry: () => void;
}) {
  const t = useTranslations("today");
  const tRecap = useTranslations("recap");
  const common = useTranslations("common");
  const locale = useLocale();
  const gentle = useGentle();
  const g = (key: string) => gentleKey(key, gentle, t.has);
  const { plan, loaded, failed: planFailed, retry: retryPlan } = usePlan();
  const cashQuery = useQuery({ queryKey: ["cash-ahead"], queryFn: getCashAhead });
  const suggestionsQuery = useQuery({ queryKey: ["suggestions"], queryFn: getSuggestions });
  const wellbeingQuery = useQuery({ queryKey: ["wellbeing"], queryFn: getWellbeing });
  const tWell = useTranslations("wellbeing");
  const cash = cashQuery.data;
  const suggestions = suggestionsQuery.data?.suggestions ?? [];
  const attention = home?.needsAttention;
  const state = todayState({
    pending: homePending || !loaded || cashQuery.isPending || suggestionsQuery.isPending,
    failed: homeFailed || planFailed || cashQuery.isError || suggestionsQuery.isError ||
      !!home?.errors.some((error) => error.section === "needsAttention" || error.section === "bankHealth"),
    hasCash: !!cash,
    balance: cash?.safeToSpend ?? null,
    connected: (home?.bankHealth?.length ?? 0) > 0,
    checkedThisWeek: plan.checkin.lastWeek === isoWeek(new Date()),
    needsReview: !!attention && (attention.uncategorized > 0 || attention.lowConfidence > 0 || attention.flagged > 0),
    hasSuggestions: suggestions.length > 0,
  });
  const date = (iso: string) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(new Date(`${iso}T12:00:00`));
  const free = cash?.safeToSpend ?? null;
  const ready = state !== "loading" && state !== "error";
  const money = (value: number) => shekels(value, locale);
  const sentence = state === "loading" ? t("loading")
    : state === "error" ? t("loadFailed")
    : state === "connect" ? t(g("noBank"))
    : state === "sync" ? t(g("needsBalance"))
    : free! < 0 ? t(g("short"), { amount: money(-free!), date: date(cash!.until) })
    : t(g("fine"), { amount: money(free!), date: date(cash!.until), perDay: money(free! / Math.max(1, cash!.daysLeft)) });
  const actions = {
    cash: { href: "/overview?tab=ahead", label: t("reviewBills"), hint: t("reviewBillsHint") },
    connect: { href: "/settings/bank", label: t("connect"), hint: t("connectHint") },
    sync: { href: "/settings/bank", label: t("manageBanks"), hint: t("syncHint") },
    checkin: { href: "/checkin", label: t("nextCheckin"), hint: t(g("checkinHint")) },
    review: { href: "/transactions", label: t("reviewAction"), hint: t(g("reviewHint")) },
    suggestions: { href: "/checkin", label: t("nextSuggestion", { count: suggestions.length }), hint: t(g("suggestionHint")) },
  };
  const next = state in actions ? actions[state as keyof typeof actions] : null;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const nextBill = bills?.filter((bill) => bill.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
  const month = home?.thisMonth;
  const stats = [
    month && home?.bankHealth?.some((bank) => bank.lastSyncAt) && { label: t("statSpent"), value: money(month.spent) },
    nextBill && { label: t("statBill", { date: date(nextBill.date) }), value: money(bills!.filter(b => b.date === nextBill.date).reduce((sum, b) => sum + b.total, 0)) },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <section aria-labelledby="today-title" aria-busy={state === "loading"} className="wallet mb-6 overflow-hidden rounded-3xl border border-white/10 p-6 shadow-sm sm:p-8 md:mb-8 lg:p-10">
      {gentle && (
        <p className="mb-5 rounded-xl glass-tile px-4 py-3 text-sm text-muted-foreground">
          {t("gentleBanner")}{" "}
          <Link href="/settings/household" className="font-medium text-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">{t("gentleSettings")}</Link>
        </p>
      )}
      <h2 id="today-title" className="mb-4 text-footnote font-medium text-muted-foreground">{t("title")} <WhatIs concept="free" /></h2>
      {ready && free != null && <div className="mb-4"><p className="text-sm text-muted-foreground">{locale === "he" ? "פנוי לאחר התחייבויות וכסף ששמרת" : "Available after obligations and reserves"}</p><p className="mt-2 text-5xl font-medium tracking-tight"><bdi>{money(free)}</bdi></p></div>}
      <p role="status" className={cn("max-w-3xl text-lg font-medium leading-relaxed text-pretty sm:text-xl", !gentle && ready && free != null && free < 0 && "text-status-heads-up")}>{ready && free != null && cash ? (locale === "he" ? `עד ${date(cash.until)} · ממוצע של ${money(Math.max(0, free) / Math.max(1, cash.daysLeft))} ליום לפי האומדן` : `Until ${date(cash.until)} · ${money(Math.max(0, free) / Math.max(1, cash.daysLeft))} per day on this estimate`) : sentence}</p>
      {state === "error" && (
        <button type="button" onClick={() => { onRetry(); void retryPlan(); void cashQuery.refetch(); void suggestionsQuery.refetch(); }} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full glass-tile px-5 text-sm font-semibold hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
          <RefreshCw className="size-4" aria-hidden />{common("tryAgain")}
        </button>
      )}
      {ready && free != null && cash && (
        <details className="mt-4 max-w-2xl text-sm text-muted-foreground">
          <summary className="w-fit cursor-pointer rounded-md py-2 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">{t("calculationTitle")}</summary>
          <p className="mt-2 leading-relaxed">{t("calculation", { bank: money(cash.bank ?? 0), bills: money(cash.billsDue) })}</p>
          <p className="mt-2 leading-relaxed">{locale === "he" ? "יתרה בבנק פחות תחזית חיובי הכרטיס עד יום ההכנסה. התחזית כוללת גם אומדן קניות לפי ההיסטוריה. מופחתות גם הוראות קבע שזוהו, התחייבויות בנקאיות שהוספת וכסף שבחרת לשמור. הכנסה עתידית אינה נחשבת זמינה. זה אינו הסכום שנותר בתקציב: התקציב משווה בין התכנון החודשי לבין ההוצאות שסווגו." : "Bank balance minus forecast card bills until payday, including estimated spending based on history. Detected and manually added bank obligations and your cash reserve are also deducted. Future income is not yet available. This differs from budget remaining, which compares your monthly plan with categorized spending."}</p>
          <p className="mt-2 leading-relaxed">{locale === "he" ? "הממוצע ליום כאן מחושב עד יום ההכנסה; בתקציב הוא מחושב עד סוף החודש." : "The daily figure here runs until payday; the budget daily figure runs until month-end."}</p>
          <p className="mt-2">{locale === "he" ? "חיובים בבנק: " : "Bank obligations: "}{money(cash.bankDebitsDue??0)} · {locale === "he" ? "כסף ששמרת: " : "Reserved: "}{money(cash.reservedCash??0)}</p><Link className="underline" href="/control">{locale === "he" ? "בדיקת ההתחייבויות והנתונים" : "Review obligations and data"}</Link>
          <ul className="mt-3 space-y-2">{cash.accounts?.map(a => <li key={`${a.provider}-${a.accountNumber}`}><bdi>{a.provider} · ••••{a.accountNumber}</bdi> · <bdi>{money(a.balance)}</bdi><span className="block text-xs">{locale === "he" ? "עדכון יתרה: " : "Balance updated: "}{a.updatedAt}</span></li>)}</ul>
          {home?.bankHealth?.some(b => b.status !== "ok") && <p className="mt-3 font-medium">{locale === "he" ? "יש מקור שאינו מעודכן. בדקו את החיבורים לפני הסתמכות על הסכומים." : "Some sources are not current. Check connections before relying on these amounts."}</p>}
        </details>
      )}
      {next && (
        <Link href={next.href} className="mt-6 flex min-h-20 items-center justify-between gap-4 rounded-2xl glass-tile px-5 py-5 hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
          <span className="min-w-0">
            <span className="mb-1 block text-caption text-muted-foreground">{t(g("nextLabel"))}</span>
            <span className="block text-lg font-semibold">{next.label}</span>
            <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{next.hint}</span>
          </span>
          <Forward className="size-5" />
        </Link>
      )}
      {state === "done" && <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="size-5 shrink-0" aria-hidden />{t("allDone")}</p>}
      {!gentle && ready && stats.length > 0 && <dl className="mt-6 grid gap-3 sm:grid-cols-2">
        {stats.map((stat) => <div key={stat.label} className="glass-tile min-w-0 rounded-2xl px-5 py-4"><dt className="text-sm text-muted-foreground">{stat.label}</dt><dd className="figure mt-2 break-words text-3xl"><bdi>{stat.value}</bdi></dd></div>)}
      </dl>}
      {wellbeingQuery.data && wellbeingDue(wellbeingQuery.data, today) && (
        <Link href="/wellbeing" className="mt-6 me-6 inline-flex min-h-11 items-center gap-1 rounded-lg text-sm font-medium text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
          {tWell("todayLink")}
          <Forward />
        </Link>
      )}
      {Number(today.slice(8)) <= 7 && (
        <Link href="/recap" className="mt-6 inline-flex min-h-11 items-center gap-1 rounded-lg text-sm font-medium text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
          {tRecap("todayLink", { month: new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(new Date(`${lastCompleteMonth(today)}-15T12:00:00Z`)) })}
          <Forward />
        </Link>
      )}
    </section>
  );
}
