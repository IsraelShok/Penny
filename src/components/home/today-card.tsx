"use client";

import { Forward } from "@/components/ui/dir-chevron";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckCircle2, X } from "lucide-react";
import { dismissSuggestion, getAssets, getCashAhead, getCashflowHealth, getLifeProgress, getSuggestions, getWellbeing } from "@/lib/api";
import { wellbeingDue } from "@/lib/wellbeing";
import { isoWeek } from "@/lib/plan";
import { todayState } from "@/lib/today-state";
import { lastCompleteMonth } from "@/lib/recap";
import { usePlan } from "@/hooks/use-plan";
import { useGentle } from "@/hooks/use-gentle";
import { gentleKey } from "@/lib/gentle";
import { useHousehold } from "@/hooks/use-household";
import { isGentle } from "@/lib/household";
import { currentStage, LIFE_STAGES } from "@/lib/life-stages";
import { nextStep } from "@/lib/next-step";
import { allocate, liquidCash } from "@/lib/allocation";
import { shekels } from "@/lib/money";
import type { HomePayload } from "@/lib/types";

/**
 * The one next thing to do today (connect, sync, review, check in…), plus the occasional wellbeing and recap links.
 * Lives inside the forecast card on Advanced mode's Home, on its dark surface.
 */
export function NextStep({ home, homePending, homeFailed }: { home: HomePayload | undefined; homePending: boolean; homeFailed: boolean }) {
  const t = useTranslations("today");
  const tRecap = useTranslations("recap");
  const tWell = useTranslations("wellbeing");
  const locale = useLocale();
  const gentle = useGentle();
  const g = (key: string) => gentleKey(key, gentle, t.has);
  const { plan, loaded, failed: planFailed } = usePlan();
  const cashQuery = useQuery({ queryKey: ["cash-ahead"], queryFn: getCashAhead });
  const suggestionsQuery = useQuery({ queryKey: ["suggestions"], queryFn: getSuggestions });
  const wellbeingQuery = useQuery({ queryKey: ["wellbeing"], queryFn: getWellbeing });
  const cashflowQuery = useQuery({ queryKey: ["cashflow-health"], queryFn: getCashflowHealth });
  const assetsQuery = useQuery({ queryKey: ["assets"], queryFn: getAssets });
  const lifeQuery = useQuery({ queryKey: ["life-progress"], queryFn: getLifeProgress });
  const { household, loading: householdLoading, failed: householdFailed } = useHousehold();
  const queryClient = useQueryClient();
  const dismiss = useMutation({
    mutationFn: (key: string) => dismissSuggestion(key),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["suggestions"] }),
    onError: () => toast.error(t("step.dismissFailed")),
  });
  const suggestions = suggestionsQuery.data?.suggestions ?? [];
  const attention = home?.needsAttention;
  const state = todayState({
    pending: homePending || !loaded || cashQuery.isPending || suggestionsQuery.isPending,
    failed: homeFailed || planFailed || cashQuery.isError || suggestionsQuery.isError ||
      !!home?.errors.some((error) => error.section === "needsAttention" || error.section === "bankHealth"),
    hasCash: !!cashQuery.data,
    balance: cashQuery.data?.safeToSpend ?? null,
    connected: (home?.bankHealth?.length ?? 0) > 0,
    checkedThisWeek: plan.checkin.lastWeek === isoWeek(new Date()),
    needsReview: !!attention && (attention.uncategorized > 0 || attention.lowConfidence > 0 || attention.flagged > 0),
    hasSuggestions: suggestions.length > 0,
  });
  const actions = {
    cash: { href: "/overview?tab=ahead", label: t("reviewBills"), hint: t("reviewBillsHint") },
    connect: { href: "/settings/bank", label: t("connect"), hint: t("connectHint") },
    sync: { href: "/settings/bank", label: t("manageBanks"), hint: t("syncHint") },
    checkin: { href: "/checkin", label: t("nextCheckin"), hint: t(g("checkinHint")) },
    review: { href: "/transactions", label: t("reviewAction"), hint: t(g("reviewHint")) },
    suggestions: { href: "/checkin", label: t("nextSuggestion", { count: suggestions.length }), hint: t(g("suggestionHint")) },
  };
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

  // Gentle mode silences money nudges even when no life stage fits.
  const stage = currentStage(household, plan) ?? (isGentle(household) ? { stageId: "", gentle: true } : null);
  const stageDef = stage?.stageId ? LIFE_STAGES.find((s) => s.id === stage.stageId) : undefined;
  const doneItems = (stage && lifeQuery.data?.[stage.stageId]) ?? [];
  // Without progress we can't tell a done item from an open one.
  const stageItemId = !stage || !stageDef || !lifeQuery.isSuccess ? null
    : stage.gentle ? stageDef.items.find((item) => !doneItems.includes(item.id))?.id ?? null
    : doneItems.includes(stageDef.keyItem) ? null : stageDef.keyItem;
  const cf = cashflowQuery.data;
  const step = nextStep({
    today: state,
    month: today.slice(0, 7),
    stage,
    stageItemId,
    // Unknown household = unknown gentle mode, and unknown assets = wrong amounts: skip money steps then.
    alloc: !householdFailed && assetsQuery.isSuccess && cf?.hasData && cf.avgIncome > 0
      ? allocate({ income: cf.avgIncome, expenses: cf.avgExpenses, liquidNow: liquidCash(assetsQuery.data.assets), emergencyMonths: plan.emergencyMonths })
      : null,
    suggestions: householdFailed ? [] : suggestions,
    dismissed: new Set(suggestionsQuery.data?.dismissed ?? []),
  });
  const L = locale === "he" ? "he" : "en";
  const amount = shekels(Math.round(step?.amount ?? 0), locale);
  const next = !step ? null
    : step.kind in actions ? actions[step.kind as keyof typeof actions]
    : step.kind === "stageItem" ? {
      href: step.href,
      label: stageDef?.items.find((item) => item.id === step.itemId)?.text[L] ?? "",
      hint: t(stage?.gentle ? "step.stageItem.hint_gentle" : "step.stageItem.hint"),
    }
    : {
      href: step.href,
      label: t(`step.${step.kind}.label`, { amount }),
      hint: t(g(`step.${step.kind}.hint`), { amount, months: step.months ?? 0, n: plan.emergencyMonths }),
    };
  const linkClass = "inline-flex min-h-11 items-center gap-1 rounded-lg text-sm font-medium text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white";

  if (state === "loading" || state === "error") return null;
  // Wait for the step inputs so the tile doesn't jump from one step to another.
  if (householdLoading || cashflowQuery.isPending || assetsQuery.isPending || lifeQuery.isPending) return null;
  return (
    <div className="mt-4 space-y-2">
      {stageDef && (
        <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
          <span>{stageDef.title[L]}</span>
          <span aria-hidden>·</span>
          <Link href="/life" className={linkClass}>{t("stage")}</Link>
        </p>
      )}
      {next && step && (
        <div className="flex items-center border-t border-white/20 pt-2">
          <Link href={next.href} className="flex min-h-14 min-w-0 flex-1 items-center justify-between gap-4 rounded-2xl px-4 py-3 hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
            <span className="min-w-0">
              <span className="block text-caption text-muted-foreground">{t(g("nextLabel"))}</span>
              <span className="block font-semibold">{next.label}</span>
              <span className="block text-sm leading-relaxed text-muted-foreground">{next.hint}</span>
            </span>
            <Forward className="size-5 shrink-0" />
          </Link>
          {step.dismissible && (
            <button
              type="button"
              aria-label={t("step.notNow")}
              title={t("step.notNow")}
              disabled={dismiss.isPending}
              onClick={() => dismiss.mutate(step.key)}
              className="me-1 grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50"
            >
              <X className="size-5" aria-hidden />
            </button>
          )}
        </div>
      )}
      {!step && state === "done" && <p className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="size-5 shrink-0" aria-hidden />{t("allDone")}</p>}
      <div className="flex flex-wrap gap-x-5">
        {wellbeingQuery.data && wellbeingDue(wellbeingQuery.data, today) && (
          <Link href="/wellbeing" className={linkClass}>{tWell("todayLink")}<Forward /></Link>
        )}
        {Number(today.slice(8)) <= 7 && (
          <Link href="/recap" className={linkClass}>
            {tRecap("todayLink", { month: new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(new Date(`${lastCompleteMonth(today)}-15T12:00:00Z`)) })}
            <Forward />
          </Link>
        )}
      </div>
    </div>
  );
}
