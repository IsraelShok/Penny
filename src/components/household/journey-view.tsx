"use client";

import Link from "next/link";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { getAssets, getFi, getPlan, getRecap } from "@/lib/api";
import { useHousehold } from "@/hooks/use-household";
import { detectMilestones, sortNewestFirst, type Milestone } from "@/lib/milestones";
import { lastCompleteMonth, shiftMonth } from "@/lib/recap";

const ils = (n: number, locale: string) =>
  new Intl.NumberFormat(locale === "he" ? "he-IL" : "en-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n);

// shortcut: one recap call per month for the last 12; move to a server endpoint if more history is needed.
const MONTHS = 12;

export function JourneyView() {
  const t = useTranslations("journey");
  const tH = useTranslations("household");
  const locale = useLocale();
  const { household, loading } = useHousehold();
  const assets = useQuery({ queryKey: ["assets"], queryFn: getAssets });
  const plan = useQuery({ queryKey: ["plan"], queryFn: getPlan });
  const fi = useQuery({ queryKey: ["fi"], queryFn: getFi });
  const last = lastCompleteMonth(new Date().toISOString().slice(0, 10));
  const recaps = useQueries({
    queries: Array.from({ length: MONTHS }, (_, i) => shiftMonth(last, -i)).map((month) => ({
      queryKey: ["recap", month],
      queryFn: () => getRecap({ month }),
    })),
  });

  const me = household.members.find((m) => m.role === "me")?.name;
  const months = recaps.flatMap((r) => (r.data?.mode === "month" ? [{ month: r.data.recap.month, income: r.data.recap.income, kept: r.data.recap.kept }] : []));
  const milestones = detectMilestones({
    history: assets.data?.history ?? [],
    liabilities: (assets.data?.assets ?? []).filter((a) => a.isLiability).map((a) => ({ name: a.name, value: a.valueIls, updatedAt: a.updatedAt })),
    goals: plan.data?.goals ?? [],
    months,
    cashReserve: fi.data?.cashReserve ?? 0,
    monthlyExpenses: fi.data?.monthlyExpenses ?? 0,
  });

  const fmtDate = new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-IL", { year: "numeric", month: "long" });
  const items = sortNewestFirst([
    ...household.events.map((e) => ({ key: `e-${e.id}`, date: e.date as string | null, title: tH(`event.${e.type}`), body: t(`eventNote.${e.type}`), life: true })),
    ...milestones.map((m, i) => ({ key: `m-${i}`, date: m.date, title: milestoneTitle(m), body: milestoneBody(m), life: false })),
  ]);

  function milestoneTitle(m: Milestone): string {
    switch (m.kind) {
      case "netWorth": return t("netWorthTitle", { amount: ils(m.amount, locale) });
      case "debtPaid": return t("debtPaidTitle", { name: m.name });
      case "goalReached": return t("goalTitle", { name: m.name });
      case "savingsRate": return t("savingsRateTitle", { rate: Math.round(m.rate * 100) });
      case "emergency": return t("emergencyTitle", { months: m.months });
    }
  }
  function milestoneBody(m: Milestone): string {
    const who = me ?? "";
    switch (m.kind) {
      case "netWorth": return t("netWorthBody", { name: who });
      case "debtPaid": return t("debtPaidBody");
      case "goalReached": return t("goalBody");
      case "savingsRate": return t("savingsRateBody", { month: fmtDate.format(new Date(`${m.month}-01`)) });
      case "emergency": return t("emergencyBody", { months: m.months });
    }
  }

  if (loading || assets.isLoading) return <p className="text-subheadline text-muted-foreground">{t("loading")}</p>;

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-border/60 bg-card p-6 text-center">
        <p className="text-body">{t("empty")}</p>
        <Link href="/settings/household" className="mt-3 inline-block text-subheadline text-primary hover:underline">
          {t("addEvent")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <p className="mb-6 text-subheadline text-muted-foreground">{me ? t("introNamed", { name: me }) : t("intro")}</p>
      <ol className="relative space-y-6 border-s-2 border-border ps-6">
        {items.map((it) => (
          <li key={it.key} className="relative">
            <span
              aria-hidden
              className={`absolute -start-[1.95rem] top-1.5 size-3.5 rounded-full ring-4 ring-background ${it.life ? "bg-muted-foreground" : "bg-primary"}`}
            />
            <p className="text-footnote text-muted-foreground">{it.date ? fmtDate.format(new Date(it.date)) : t("now")}</p>
            <h2 className="text-headline font-semibold">{it.title}</h2>
            <p className="text-subheadline text-muted-foreground">{it.body}</p>
          </li>
        ))}
      </ol>
      <Link href="/settings/household" className="mt-8 inline-block text-subheadline text-primary hover:underline">
        {t("addEvent")}
      </Link>
    </div>
  );
}
