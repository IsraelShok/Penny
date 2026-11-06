"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, CheckCircle2, RefreshCw } from "lucide-react";
import { getCashAhead, getSuggestions } from "@/lib/api";
import { isoWeek } from "@/lib/plan";
import { todayState } from "@/lib/today-state";
import { shekels } from "@/lib/money";
import { usePlan } from "@/hooks/use-plan";
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
  const common = useTranslations("common");
  const locale = useLocale();
  const { plan, loaded, failed: planFailed, retry: retryPlan } = usePlan();
  const cashQuery = useQuery({ queryKey: ["cash-ahead"], queryFn: getCashAhead });
  const suggestionsQuery = useQuery({ queryKey: ["suggestions"], queryFn: getSuggestions });
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
    : state === "connect" ? t("noBank")
    : state === "sync" ? t("needsBalance")
    : free! < 0 ? t("short", { amount: money(-free!), date: date(cash!.until) })
    : t("fine", { amount: money(free!), date: date(cash!.until), perDay: money(free! / Math.max(1, cash!.daysLeft)) });
  const actions = {
    cash: { href: "/insights", label: t("reviewBills"), hint: t("reviewBillsHint") },
    connect: { href: "/settings/bank", label: t("connect"), hint: t("connectHint") },
    sync: { href: "/settings/bank", label: t("manageBanks"), hint: t("syncHint") },
    checkin: { href: "/checkin", label: t("nextCheckin"), hint: t("checkinHint") },
    review: { href: "/transactions", label: t("reviewAction"), hint: t("reviewHint") },
    suggestions: { href: "/checkin", label: t("nextSuggestion", { count: suggestions.length }), hint: t("suggestionHint") },
  };
  const next = state in actions ? actions[state as keyof typeof actions] : null;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const nextBill = bills?.filter((bill) => bill.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
  const month = home?.thisMonth;
  const stats = [
    free != null && { label: t("statFree"), value: money(free) },
    month && home?.bankHealth?.some((bank) => bank.lastSyncAt) && { label: t("statSpent"), value: money(month.spent) },
    nextBill && { label: t("statBill", { date: date(nextBill.date) }), value: money(nextBill.total) },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <section aria-labelledby="today-title" aria-busy={state === "loading"} className="wallet mb-6 overflow-hidden rounded-3xl border border-white/10 p-6 shadow-sm sm:p-8 md:mb-8 lg:p-10">
      <h2 id="today-title" className="mb-4 text-footnote font-medium text-muted-foreground">{t("title")}</h2>
      <p role="status" className={cn("max-w-3xl text-2xl font-semibold leading-relaxed text-pretty sm:text-3xl", ready && free != null && free < 0 && "text-status-heads-up")}>{sentence}</p>
      {state === "error" && (
        <button type="button" onClick={() => { onRetry(); void retryPlan(); void cashQuery.refetch(); void suggestionsQuery.refetch(); }} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white/10 px-5 text-sm font-semibold hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
          <RefreshCw className="size-4" aria-hidden />{common("tryAgain")}
        </button>
      )}
      {ready && free != null && cash && (
        <details className="mt-4 max-w-2xl text-sm text-muted-foreground">
          <summary className="w-fit cursor-pointer rounded-md py-2 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">{t("calculationTitle")}</summary>
          <p className="mt-2 leading-relaxed">{t("calculation", { bank: money(cash.bank ?? 0), bills: money(cash.billsDue) })}</p>
          <p className="mt-2 leading-relaxed">{t("estimateNote")}</p>
        </details>
      )}
      {next && (
        <Link href={next.href} className="mt-6 flex min-h-20 items-center justify-between gap-4 rounded-2xl bg-white/10 px-5 py-5 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
          <span className="min-w-0">
            <span className="mb-1 block text-caption text-muted-foreground">{t("nextLabel")}</span>
            <span className="block text-lg font-semibold">{next.label}</span>
            <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{next.hint}</span>
          </span>
          <ArrowLeft className="size-5 shrink-0 ltr:rotate-180" aria-hidden />
        </Link>
      )}
      {state === "done" && <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="size-5 shrink-0" aria-hidden />{t("allDone")}</p>}
      {ready && stats.length > 0 && <dl className="mt-8 grid gap-5 border-t border-white/10 pt-6 sm:grid-cols-3">
        {stats.map((stat) => <div key={stat.label} className="min-w-0"><dt className="text-sm text-muted-foreground">{stat.label}</dt><dd className="figure mt-2 break-words text-3xl"><bdi>{stat.value}</bdi></dd></div>)}
      </dl>}
    </section>
  );
}
