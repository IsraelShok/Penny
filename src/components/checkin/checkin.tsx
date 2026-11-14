"use client";

import { toast } from "sonner";
import { Forward } from "@/components/ui/dir-chevron";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Check, PartyPopper } from "lucide-react";
import { getCashAhead, getHome, getTransactionsSummary } from "@/lib/api";
import { completeCheckin } from "@/lib/plan";
import { shekels } from "@/lib/money";
import { usePlan } from "@/hooks/use-plan";
import { useGentle } from "@/hooks/use-gentle";
import { gentleKey } from "@/lib/gentle";
import { Button } from "@/components/ui/button";
import { SuggestionsCard } from "@/components/home/suggestions-card";

const STEPS = 3;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return iso(d);
};

/** Picks the "_gentle" copy variant when gentle mode is on. */
function useCopy() {
  const t = useTranslations("checkin");
  const gentle = useGentle();
  return { t, gentle, g: (key: string) => gentleKey(key, gentle, t.has) };
}

/** The weekly ritual: three short steps with a visible end, then the outcome (the streak stays a quiet footnote). */
export function Checkin() {
  const locale = useLocale();
  const t = useTranslations("checkin");
  const { plan, update, saving } = usePlan();
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<number | null>(null);

  if (done != null) return <Done streak={done} />;

  const finish = async () => {
    const checkin = completeCheckin(plan.checkin, new Date());
    try { await update({ checkin }); setDone(checkin.streak); }
    catch { toast.error(t("couldNotSaveYour")); }
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
            <Forward />
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

/** Celebrates what the money did, not the habit. Gentle mode: no icon, no numbers, no streak. */
function Done({ streak }: { streak: number }) {
  const { t, gentle, g } = useCopy();
  const locale = useLocale();
  const cash = useQuery({ queryKey: ["cash-ahead"], queryFn: getCashAhead }).data;
  const free = cash?.safeToSpend;
  const date = cash ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(new Date(`${cash.until}T12:00:00`)) : "";
  return (
    <div className="rounded-2xl bg-card p-8 text-center" role="status">
      {!gentle && <PartyPopper className="mx-auto mb-4 size-10 text-status-on-track" aria-hidden />}
      <p className="text-title font-semibold">{t(g("doneTitle"))}</p>
      {!gentle && free != null && free >= 0 && (
        <p className="mt-2 text-headline">{t("doneOutcome", { amount: shekels(free, locale), date })}</p>
      )}
      {!gentle && <p className="mt-2 text-caption text-muted-foreground">{t("doneStreak", { weeks: streak })}</p>}
      <Button className="mt-6" nativeButton={false} render={<Link href="/">{t("backHome")}</Link>} />
    </div>
  );
}

function StepCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-card p-7">
      <h2 className="text-title font-semibold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function WeekStep() {
  const { t, gentle, g } = useCopy();
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
    if (!usual) line = t(g("weekPlain"), { spent: money(spent) });
    else if (spent > usual * 1.15) line = t(g("weekMore"), { spent: money(spent), usual: money(usual) });
    else if (spent < usual * 0.85) line = t(g("weekLess"), { spent: money(spent), usual: money(usual) });
    else line = t(g("weekUsual"), { spent: money(spent) });
  }

  return (
    <StepCard title={t(g("weekTitle"))}>
      <p className="text-headline">{line}</p>
      {!gentle && week?.expense.largest && (
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
  const { t, g } = useCopy();
  return (
    <div>
      <p className="mb-3 px-1 text-footnote text-muted-foreground">{t(g("findingHint"))}</p>
      <SuggestionsCard
        limit={1}
        empty={
          <StepCard title={t(g("findingTitle"))}>
            <p className="text-footnote text-muted-foreground">{t(g("noFindings"))}</p>
          </StepCard>
        }
      />
    </div>
  );
}

function AheadStep() {
  const { t, gentle, g } = useCopy();
  const locale = useLocale();
  const cash = useQuery({ queryKey: ["cash-ahead"], queryFn: getCashAhead }).data;
  const date = cash ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(new Date(`${cash.until}T12:00:00`)) : "";
  return (
    <StepCard title={t(g("aheadTitle"))}>
      {!cash ? (
        <p className="text-footnote text-muted-foreground">…</p>
      ) : cash.safeToSpend == null ? (
        <p className="text-headline">{t(g("aheadNoBank"))}</p>
      ) : (
        <>
          <p className="text-headline">
            {cash.safeToSpend >= 0
              ? t(g("aheadFine"), { amount: shekels(cash.safeToSpend, locale), date, perDay: shekels(cash.safeToSpend / Math.max(1, cash.daysLeft), locale) })
              : t(g("aheadShort"), { amount: shekels(-cash.safeToSpend, locale), date })}
          </p>
          {!gentle && <p className="mt-2 text-footnote text-muted-foreground">{t("aheadBills", { amount: shekels(cash.billsDue, locale) })}</p>}
        </>
      )}
    </StepCard>
  );
}
