"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, Plus, Trash2 } from "lucide-react";
import { deletePlanItem, getPlan, savePlan, savePlanItem } from "@/lib/api";
import { goalMonthly, type FinancialPlan } from "@/lib/plan";
import { fmt, shekels } from "@/lib/money";
import { CardShell } from "@/components/home/card-shell";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkline } from "@/components/ui/sparkline";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { POLICY_KINDS, type FiPayload, type Goal, type InsurancePolicy } from "@/lib/types";

/** Everything below the FI calculator: plan settings, safety net, goals, tax and insurance. */
export function FiExtras({ data }: { data: FiPayload }) {
  const query = useQuery({ queryKey: ["plan"], queryFn: getPlan });
  if (!query.data) return null;
  const { plan, goals, policies } = query.data;
  return (
    <>
      <EmergencyFund data={data} months={plan.emergencyMonths} />
      <Forecast data={data} />
      <PlanSettings plan={plan} />
      <Goals goals={goals} />
      <Tax data={data} plan={plan} />
      <Insurance policies={policies} monthlyExpenses={data.monthlyExpenses} />
    </>
  );
}

function useSavePlan() {
  const t = useTranslations("plan");
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (plan: FinancialPlan) => savePlan(plan),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plan"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      toast.success(t("saved"));
    },
    onError: () => toast.error(t("saveFailed")),
  });
}

function EmergencyFund({ data, months }: { data: FiPayload; months: number }) {
  const t = useTranslations("plan");
  const locale = useLocale();
  const covered = data.monthlyExpenses > 0 ? data.cashReserve / data.monthlyExpenses : null;
  const target = data.monthlyExpenses * months;
  const ok = covered != null && covered >= months;
  return (
    <CardShell label={t("emergencyTitle")}>
      <p className={cn("figure text-[2.5rem] leading-none", covered != null && !ok && "text-status-heads-up")}>
        {covered == null ? "—" : t("monthsValue", { n: fmt(covered, locale, 1) })}
      </p>
      <p className="mt-2 text-footnote text-muted-foreground">
        {covered == null ? t("emergencyNoData") : ok ? t("emergencyOk", { months }) : t("emergencyGap", { amount: shekels(target - data.cashReserve, locale), months })}
      </p>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="h-full rounded-full bg-foreground" style={{ width: `${Math.min(100, ((covered ?? 0) / months) * 100)}%` }} />
      </div>
      <p className="mt-2 text-caption text-muted-foreground">{t("emergencyHint", { cash: shekels(data.cashReserve, locale) })}</p>
    </CardShell>
  );
}

function Forecast({ data }: { data: FiPayload }) {
  const t = useTranslations("plan");
  const locale = useLocale();
  const net = data.monthlyIncome - data.monthlyExpenses;
  const points = Array.from({ length: 13 }, (_, i) => data.cashReserve + net * i);
  return (
    <CardShell label={t("forecastTitle")}>
      <p className={cn("figure text-[2.5rem] leading-none", points[12] < 0 && "text-status-over")}>{shekels(points[12], locale)}</p>
      <p className="mt-2 text-footnote text-muted-foreground">{t("forecastHint", { net: shekels(net, locale) })}</p>
      <Sparkline values={points} color="var(--foreground)" label={t("forecastTitle")} fitToRange className="mt-4 h-14 w-full" />
      <div className="mt-1 flex justify-between text-caption text-muted-foreground">
        <span>{t("today")}</span>
        <span>{t("in12")}</span>
      </div>
    </CardShell>
  );
}

function PlanSettings({ plan }: { plan: FinancialPlan }) {
  const t = useTranslations("plan");
  const save = useSavePlan();
  const [draft, setDraft] = useState({
    birthYear: plan.birthYear?.toString() ?? "",
    retirementAge: String(plan.retirementAge),
    emergencyMonths: String(plan.emergencyMonths),
    monthStartDay: String(plan.monthStartDay),
  });
  const fields = [
    { k: "birthYear", min: 1920, max: 2015 },
    { k: "retirementAge", min: 40, max: 80 },
    { k: "emergencyMonths", min: 1, max: 24 },
    { k: "monthStartDay", min: 1, max: 28 },
  ] as const;
  return (
    <CardShell label={t("settingsTitle")}>
      <form
        className="grid grid-cols-2 gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate({ ...plan, birthYear: draft.birthYear ? Number(draft.birthYear) : null, retirementAge: Number(draft.retirementAge), emergencyMonths: Number(draft.emergencyMonths), monthStartDay: Number(draft.monthStartDay) });
        }}
      >
        {fields.map(({ k, min, max }) => (
          <div key={k} className="space-y-1.5">
            <Label htmlFor={`plan-${k}`}>{t(`field_${k}`)}</Label>
            <Input id={`plan-${k}`} type="number" min={min} max={max} dir="ltr" value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} />
          </div>
        ))}
        <p className="col-span-2 text-caption text-pretty text-muted-foreground">{t("settingsHint")}</p>
        <IconButton label={t("save")} variant="default" type="submit" className="col-span-2 justify-self-start" disabled={save.isPending}><Check className="size-4" aria-hidden /></IconButton>
      </form>
    </CardShell>
  );
}

function Goals({ goals }: { goals: Goal[] }) {
  const t = useTranslations("plan");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState({ name: "", targetAmount: "", targetDate: "", savedAmount: "" });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["plan"] });
  const add = useMutation({
    mutationFn: () => savePlanItem("goal", draft),
    onSuccess: () => {
      setDraft({ name: "", targetAmount: "", targetDate: "", savedAmount: "" });
      refresh();
    },
    onError: (e: Error) => toast.error(e.message || t("saveFailed")),
  });
  const remove = useMutation({ mutationFn: (id: number) => deletePlanItem("goal", id), onSuccess: refresh });
  const today = new Date();

  return (
    <CardShell label={t("goalsTitle")} className="lg:col-span-2">
      {goals.length > 0 && (
        <ul className="mb-5 grid gap-4 sm:grid-cols-2">
          {goals.map((g) => {
            const pct = Math.min(100, (g.savedAmount / g.targetAmount) * 100);
            const monthly = goalMonthly(g.targetAmount, g.savedAmount, g.targetDate, today);
            const due = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(`${g.targetDate}-15T12:00:00`));
            return (
              <li key={g.id} className="rounded-2xl bg-muted/60 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-footnote font-semibold">{g.name}</p>
                    <p className="text-caption text-muted-foreground">{t("goalDue", { date: due, target: shekels(g.targetAmount, locale) })}</p>
                  </div>
                  <Button variant="ghost" size="icon" aria-label={t("removeGoal", { name: g.name })} onClick={() => remove.mutate(g.id)}>
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-background" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={g.name}>
                  <div className="h-full rounded-full bg-foreground" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-2 text-caption text-muted-foreground">
                  {monthly === 0 ? t("goalDone") : t("goalMonthly", { amount: shekels(monthly, locale), saved: shekels(g.savedAmount, locale) })}
                </p>
              </li>
            );
          })}
        </ul>
      )}
      <form
        className="grid grid-cols-2 items-end gap-3 md:grid-cols-[2fr_1fr_1fr_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate();
        }}
      >
        <div className="col-span-2 space-y-1.5 md:col-span-1">
          <Label htmlFor="goal-name">{t("goalName")}</Label>
          <Input id="goal-name" required maxLength={60} placeholder={t("goalPlaceholder")} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="goal-target">{t("goalTarget")}</Label>
          <Input id="goal-target" required type="number" min="1" dir="ltr" value={draft.targetAmount} onChange={(e) => setDraft({ ...draft, targetAmount: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="goal-date">{t("goalDate")}</Label>
          <Input id="goal-date" required type="month" dir="ltr" value={draft.targetDate} onChange={(e) => setDraft({ ...draft, targetDate: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="goal-saved">{t("goalSaved")}</Label>
          <Input id="goal-saved" type="number" min="0" dir="ltr" value={draft.savedAmount} onChange={(e) => setDraft({ ...draft, savedAmount: e.target.value })} />
        </div>
        <IconButton label={t("addGoal")} variant="default" type="submit" disabled={add.isPending}><Plus className="size-4" aria-hidden /></IconButton>
      </form>
    </CardShell>
  );
}

const TAX_ITEMS = ["study_fund", "pension_credit", "loss_offset", "credit_points", "refund"] as const;

function Tax({ data, plan }: { data: FiPayload; plan: FinancialPlan }) {
  const t = useTranslations("plan");
  const locale = useLocale();
  const save = useSavePlan();
  const year = new Date().getFullYear();
  const toggle = (key: string, done: boolean) => {
    const taxDone = { ...plan.taxDone };
    if (done) taxDone[key] = year;
    else delete taxDone[key];
    save.mutate({ ...plan, taxDone });
  };
  const offset = Math.min(data.taxableLosses, data.deferredTax / 0.25);
  return (
    <CardShell label={t("taxTitle", { year })}>
      <dl className="grid grid-cols-2 gap-4 text-footnote">
        <div>
          <dt className="text-caption text-muted-foreground">{t("taxDeferred")}</dt>
          <dd className="figure text-[1.75rem] leading-tight">{shekels(data.deferredTax, locale)}</dd>
        </div>
        <div>
          <dt className="text-caption text-muted-foreground">{t("taxLosses")}</dt>
          <dd className="figure text-[1.75rem] leading-tight">{shekels(data.taxableLosses, locale)}</dd>
        </div>
      </dl>
      {offset > 0 && <p className="mt-2 text-footnote">{t("taxOffset", { amount: shekels(offset * 0.25, locale) })}</p>}
      <ul className="mt-4 space-y-2.5">
        {TAX_ITEMS.map((k) => {
          const done = plan.taxDone[k] === year;
          return (
            <li key={k}>
              <label className="flex cursor-pointer items-start gap-3 text-footnote">
                <input type="checkbox" className="mt-0.5 size-4 accent-[var(--foreground)]" checked={done} onChange={(e) => toggle(k, e.target.checked)} />
                <span className={cn(done && "text-muted-foreground line-through")}>
                  <span className="block font-medium">{t(`tax_${k}`)}</span>
                  <span className="text-caption text-muted-foreground">{t(`tax_${k}_hint`)}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-caption text-pretty text-muted-foreground">{t("taxNote")}</p>
    </CardShell>
  );
}

function Insurance({ policies, monthlyExpenses }: { policies: InsurancePolicy[]; monthlyExpenses: number }) {
  const t = useTranslations("plan");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState({ name: "", kind: "health" as InsurancePolicy["kind"], provider: "", monthlyPremium: "" });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["plan"] });
  const add = useMutation({
    mutationFn: () => savePlanItem("policy", draft),
    onSuccess: () => {
      setDraft({ ...draft, name: "", provider: "", monthlyPremium: "" });
      refresh();
    },
    onError: (e: Error) => toast.error(e.message || t("saveFailed")),
  });
  const remove = useMutation({ mutationFn: (id: number) => deletePlanItem("policy", id), onSuccess: refresh });
  const total = policies.reduce((s, p) => s + p.monthlyPremium, 0);
  const counts = new Map<string, number>();
  for (const p of policies) counts.set(p.kind, (counts.get(p.kind) ?? 0) + 1);
  // Two policies of the same kind (except "other") are a classic duplicate to check in Har HaBituach.
  const duplicates = [...counts.entries()].filter(([k, n]) => n > 1 && k !== "other").map(([k]) => t(`policy_${k}`));

  return (
    <CardShell label={t("insuranceTitle")} className="lg:col-span-2">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <p className="figure text-[2rem] leading-tight">{t("perMonth", { amount: shekels(total, locale) })}</p>
        {monthlyExpenses > 0 && total > 0 && (
          <p className="text-footnote text-muted-foreground">{t("insuranceShare", { pct: Math.round((total / monthlyExpenses) * 100) })}</p>
        )}
      </div>
      {duplicates.length > 0 && <p className="mt-2 text-footnote text-status-heads-up" role="status">{t("insuranceDuplicates", { kinds: duplicates.join(", ") })}</p>}
      {policies.length > 0 && (
        <ul className="mt-4 divide-y divide-border">
          {policies.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-footnote">
              <span className="min-w-0">
                <span className="block truncate font-medium">{p.name}</span>
                <span className="text-caption text-muted-foreground">{t(`policy_${p.kind}`)}{p.provider ? ` · ${p.provider}` : ""}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="tabular-nums">{shekels(p.monthlyPremium, locale)}</span>
                <Button variant="ghost" size="icon" aria-label={t("removePolicy", { name: p.name })} onClick={() => remove.mutate(p.id)}>
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <form
        className="mt-4 grid grid-cols-2 items-end gap-3 md:grid-cols-[2fr_1fr_1fr_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate();
        }}
      >
        <div className="col-span-2 space-y-1.5 md:col-span-1">
          <Label htmlFor="pol-name">{t("policyName")}</Label>
          <Input id="pol-name" required maxLength={60} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>{t("policyKind")}</Label>
          <Select value={draft.kind} onValueChange={(v) => v && setDraft({ ...draft, kind: v as InsurancePolicy["kind"] })}>
            <SelectTrigger className="w-full"><SelectValue>{(v: string) => t(`policy_${v}`)}</SelectValue></SelectTrigger>
            <SelectContent>
              {POLICY_KINDS.map((k) => <SelectItem key={k} value={k}>{t(`policy_${k}`)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pol-provider">{t("policyProvider")}</Label>
          <Input id="pol-provider" maxLength={60} value={draft.provider} onChange={(e) => setDraft({ ...draft, provider: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pol-premium">{t("policyPremium")}</Label>
          <Input id="pol-premium" required type="number" min="0" step="any" dir="ltr" value={draft.monthlyPremium} onChange={(e) => setDraft({ ...draft, monthlyPremium: e.target.value })} />
        </div>
        <IconButton label={t("add")} variant="default" type="submit" disabled={add.isPending}><Plus className="size-4" aria-hidden /></IconButton>
      </form>
      <p className="mt-3 text-caption text-pretty text-muted-foreground">{t("insuranceHint")}</p>
    </CardShell>
  );
}
