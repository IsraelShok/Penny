"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, Check, PartyPopper } from "lucide-react";
import { getCashAhead, getHome, getTransactionsSummary } from "@/lib/api";
import { completeCheckin } from "@/lib/plan";
import { shekels } from "@/lib/money";
import { usePlan } from "@/hooks/use-plan";
import { Button } from "@/components/ui/button";
import { SuggestionsCard } from "@/components/home/suggestions-card";

const STEPS = 3;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return iso(d);
};

/** The weekly ritual: three short steps with a visible end, then a streak. */
export function Checkin() {
  const t = useTranslations("checkin");
  const { plan, update, saving } = usePlan();
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<number | null>(null);

  if (done != null) {
    return (
      <div className="rounded-[1.375rem] bg-card p-8 text-center" role="status">
        <PartyPopper className="mx-auto size-10 text-status-on-track" aria-hidden />
        <p className="mt-4 text-title font-semibold">{t("doneTitle")}</p>
        <p className="mt-1 text-footnote text-muted-foreground">{t("doneStreak", { weeks: done })}</p>
        <Button className="mt-6" nativeButton={false} render={<Link href="/">{t("backHome")}</Link>} />
      </div>
    );
  }

  const finish = async () => {
    const checkin = completeCheckin(plan.checkin, new Date());
    await update({ checkin });
    setDone(checkin.streak);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div
          className="flex flex-1 gap-1.5"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={STEPS}
          aria-valuenow={step + 1}
          aria-label={t("progress", { step: step + 1, total: STEPS })}
        >
          {Array.from({ length: STEPS }, (_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>
        <span className="text-caption text-muted-foreground tabular-nums">{t("progress", { step: step + 1, total: STEPS })}</span>
      </div>

      {step === 0 && <WeekStep />}
      {step === 1 && <FindingStep />}
      {step === 2 && <AheadStep />}

      <div className="flex justify-between gap-3">
        {step > 0 ? <Button variant="ghost" onClick={() => setStep(step - 1)}>{t("back")}</Button> : <span />}
        {step < STEPS - 1 ? (
          <Button onClick={() => setStep(step + 1)}>
            {t("next")}
            <ArrowLeft className="size-4 ltr:rotate-180" aria-hidden />
          </Button>
        ) : (
          <Button onClick={finish} disabled={saving}>
            <Check className="size-4" aria-hidden />
            {t("finish")}
          </Button>
        )}
      </div>
    </div>
  );
}

function StepCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[1.375rem] bg-card p-7">
      <h2 className="text-title font-semibold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function WeekStep() {
  const t = useTranslations("checkin");
  const locale = useLocale();
  const week = useQuery({ queryKey: ["summary-week"], queryFn: () => getTransactionsSummary({ from: daysAgo(6), to: iso(new Date()) }) }).data;
  const month = useQuery({ queryKey: ["summary-4w"], queryFn: () => getTransactionsSummary({ from: daysAgo(34), to: daysAgo(7) }) }).data;
  const home = useQuery({ queryKey: ["home"], queryFn: getHome }).data;
  const toReview = (home?.needsAttention?.uncategorized ?? 0) + (home?.needsAttention?.lowConfidence ?? 0);
  const spent = week?.expense.total ?? null;
  const usual = month ? month.expense.total / 4 : null;
  const money = (n: number) => shekels(n, locale);

  let line = "…";
  if (spent != null) {
    if (!usual) line = t("weekPlain", { spent: money(spent) });
    else if (spent > usual * 1.15) line = t("weekMore", { spent: money(spent), usual: money(usual) });
    else if (spent < usual * 0.85) line = t("weekLess", { spent: money(spent), usual: money(usual) });
    else line = t("weekUsual", { spent: money(spent) });
  }

  return (
    <StepCard title={t("weekTitle")}>
      <p className="text-headline">{line}</p>
      {week?.expense.largest && (
        <p className="mt-2 text-footnote text-muted-foreground">
          {t("largest", { name: week.expense.largest.description, amount: money(Math.abs(week.expense.largest.chargedAmount)) })}
        </p>
      )}
      {toReview > 0 && (
        <Link href="/transactions" className="mt-4 inline-block text-footnote text-primary hover:underline">
          {t("review", { count: toReview })}
        </Link>
      )}
    </StepCard>
  );
}

function FindingStep() {
  const t = useTranslations("checkin");
  return (
    <div>
      <p className="mb-3 px-1 text-footnote text-muted-foreground">{t("findingHint")}</p>
      <SuggestionsCard
        limit={1}
        empty={
          <StepCard title={t("findingTitle")}>
            <p className="text-footnote text-muted-foreground">{t("noFindings")}</p>
          </StepCard>
        }
      />
    </div>
  );
}

function AheadStep() {
  const t = useTranslations("checkin");
  const locale = useLocale();
  const cash = useQuery({ queryKey: ["cash-ahead"], queryFn: getCashAhead }).data;
  const date = cash ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(new Date(`${cash.until}T12:00:00`)) : "";
  return (
    <StepCard title={t("aheadTitle")}>
      {!cash ? (
        <p className="text-footnote text-muted-foreground">…</p>
      ) : cash.safeToSpend == null ? (
        <p className="text-headline">{t("aheadNoBank")}</p>
      ) : (
        <>
          <p className="text-headline">
            {cash.safeToSpend >= 0
              ? t("aheadFine", { amount: shekels(cash.safeToSpend, locale), date, perDay: shekels(cash.safeToSpend / Math.max(1, cash.daysLeft), locale) })
              : t("aheadShort", { amount: shekels(-cash.safeToSpend, locale), date })}
          </p>
          <p className="mt-2 text-footnote text-muted-foreground">{t("aheadBills", { amount: shekels(cash.billsDue, locale) })}</p>
        </>
      )}
    </StepCard>
  );
}
