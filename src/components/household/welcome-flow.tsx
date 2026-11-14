"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { usePlan } from "@/hooks/use-plan";
import { CONFIDENCE, DETAIL, GOALS, SITUATIONS, profileEffects, type UserProfile } from "@/lib/plan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useHousehold } from "@/hooks/use-household";
import {
  INCOME_SHAPES,
  MEMBER_ROLES,
  MONEY_STYLES,
  newId,
  type Household,
  type HouseholdMember,
  type IncomeShape,
  type MoneyStyle,
} from "@/lib/household";
import { cn } from "@/lib/utils";

const chip =
  "rounded-full border px-4 py-2 text-footnote transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const chipOn = "border-primary bg-primary text-primary-foreground";
const chipOff = "border-border bg-card hover:bg-accent";

const STEPS = 6;
const SIZES = [1, 2, 3, 4, 5];

/** "Let's get to know you": situation, household, income, money style, goal, confidence. Every step skippable; answers go to the household and the plan. */
export function WelcomeFlow() {
  const t = useTranslations("welcome");
  const tH = useTranslations("household");
  const router = useRouter();
  const { household, loading, save, saving } = useHousehold();
  const [step, setStep] = useState(0);
  const [members, setMembers] = useState<HouseholdMember[] | null>(null);
  const [income, setIncome] = useState<IncomeShape | null | undefined>(undefined);
  const [style, setStyle] = useState<MoneyStyle | null | undefined>(undefined);
  const { plan, loaded, update: updatePlan } = usePlan();
  const [prof, setProf] = useState<UserProfile | null>(null);

  if (loading || !loaded) return <p className="text-footnote text-muted-foreground">{t("loading")}</p>;

  const list = members ?? household.members;
  const incomeShape = income === undefined ? household.incomeShape : income;
  const moneyStyle = style === undefined ? household.moneyStyle : style;
  const profile = prof ?? plan.profile;
  const setP = (patch: Partial<UserProfile>) => setProf({ ...profile, ...patch });
  // Tap the chosen chip again to clear it.
  const toggle = <K extends keyof UserProfile>(k: K, v: UserProfile[K]) => setP({ [k]: profile[k] === v ? null : v } as Partial<UserProfile>);

  function next(patch: Partial<Household>, finish = step === STEPS - 1) {
    // Send every answer so far: an earlier save may not have landed yet.
    save({ members: saveMembers(), incomeShape, moneyStyle, ...patch, ...(finish && { welcomeDismissed: true }) });
    const done = { ...profile, onboarded: profile.onboarded || finish };
    updatePlan({ profile: done, ...(finish && profileEffects(done)) }).catch(() => toast.error(t("saveFailed")));
    if (finish) router.push("/");
    else setStep(step + 1);
  }

  const chips = <T extends string | number>(k: keyof UserProfile, list: readonly T[], label: (v: T) => string) => (
    <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={t(`${k}Label`)}>
      {list.map((v) => (
        <button key={v} type="button" aria-pressed={profile[k] === v} className={cn(chip, "min-h-11", profile[k] === v ? chipOn : chipOff)} onClick={() => toggle(k, v as UserProfile[typeof k])}>
          {label(v)}
        </button>
      ))}
    </div>
  );

  function saveMembers() {
    // A member saved without a name keeps its role as the name.
    return list.map((m) => ({ ...m, name: m.name.trim() || tH(`role.${m.role}`) }));
  }

  const update = (id: string, patch: Partial<HouseholdMember>) =>
    setMembers(list.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  const thisYear = new Date().getFullYear();

  return (
    <div className="mx-auto max-w-xl">
      <div className="flex items-center justify-between gap-3">
        <p className="text-footnote text-muted-foreground" aria-live="polite">
          {t("stepOf", { step: step + 1, total: STEPS })}
        </p>
        <Button variant="ghost" disabled={saving} onClick={() => next({}, true)}>{t("skipAll")}</Button>
      </div>
      <div className="mt-2 flex gap-1.5" aria-hidden>
        {Array.from({ length: STEPS }, (_, i) => (
          <span key={i} className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />
        ))}
      </div>

      <section className="mt-6 rounded-2xl border border-border/60 bg-card p-5 sm:p-6" aria-labelledby="welcome-step">
        {step === 0 && (
          <>
            <h2 id="welcome-step" className="text-title font-semibold">{t("aboutTitle")}</h2>
            <p className="mt-1 text-footnote text-muted-foreground">{t("aboutHint")}</p>
            {chips("situation", SITUATIONS, (v) => t(`situation.${v}`))}
            <p className="mt-5 text-footnote font-medium">{t("householdSizeLabel")}</p>
            {chips("householdSize", SIZES, (n) => (n === 5 ? "5+" : String(n)))}
          </>
        )}

        {step === 4 && (
          <>
            <h2 id="welcome-step" className="text-title font-semibold">{t("goalTitle")}</h2>
            <p className="mt-1 text-footnote text-muted-foreground">{t("goalHint")}</p>
            {chips("goal", GOALS, (v) => t(`goal.${v}`))}
            {profile.goal === "save" && (
              <Input
                aria-label={t("goalNoteLabel")}
                placeholder={t("goalNotePlaceholder")}
                maxLength={60}
                value={profile.goalNote}
                onChange={(e) => setP({ goalNote: e.target.value })}
                className="mt-3"
              />
            )}
          </>
        )}

        {step === 5 && (
          <>
            <h2 id="welcome-step" className="text-title font-semibold">{t("levelTitle")}</h2>
            <p className="mt-1 text-footnote text-muted-foreground">{t("levelHint")}</p>
            {chips("confidence", CONFIDENCE, (v) => t(`confidence.${v}`))}
            <p className="mt-5 text-footnote font-medium">{t("detailLabel")}</p>
            {chips("detail", DETAIL, (v) => t(`detail.${v}`))}
          </>
        )}

        {step === 1 && (
          <>
            <h2 id="welcome-step" className="text-title font-semibold">{t("whoTitle")}</h2>
            <p className="mt-1 text-footnote text-muted-foreground">{t("whoHint")}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {MEMBER_ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={cn(chip, chipOff, "inline-flex items-center gap-1")}
                  onClick={() => setMembers([...list, { id: newId(), name: "", role: r, birthYear: null }])}
                >
                  <Plus className="size-4" aria-hidden />
                  {tH(`role.${r}`)}
                </button>
              ))}
            </div>
            {list.length > 0 && (
              <ul className="mt-5 space-y-3">
                {list.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-2">
                    <span className="w-24 text-footnote text-muted-foreground">{tH(`role.${m.role}`)}</span>
                    <Input
                      aria-label={t("nameFor", { role: tH(`role.${m.role}`) })}
                      placeholder={t("namePlaceholder")}
                      maxLength={80}
                      value={m.name}
                      onChange={(e) => update(m.id, { name: e.target.value })}
                      className="min-w-0 flex-1"
                    />
                    {m.role === "child" && (
                      <Input
                        aria-label={t("birthYearFor", { name: m.name || tH(`role.${m.role}`) })}
                        placeholder={t("birthYear")}
                        type="number"
                        inputMode="numeric"
                        min={1900}
                        max={thisYear}
                        className="w-28 tabular-nums"
                        value={m.birthYear ?? ""}
                        onChange={(e) => {
                          const y = Number(e.target.value);
                          update(m.id, { birthYear: e.target.value && y > 1900 && y <= thisYear ? y : null });
                        }}
                      />
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={tH("removeItem", { name: m.name || tH(`role.${m.role}`) })}
                      onClick={() => setMembers(list.filter((x) => x.id !== m.id))}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <h2 id="welcome-step" className="text-title font-semibold">{t("incomeTitle")}</h2>
            <p className="mt-1 text-footnote text-muted-foreground">{t("incomeHint")}</p>
            <div className="mt-4 flex flex-wrap gap-2" role="group" aria-labelledby="welcome-step">
              {INCOME_SHAPES.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={incomeShape === s}
                  className={cn(chip, incomeShape === s ? chipOn : chipOff)}
                  onClick={() => setIncome(incomeShape === s ? null : s)}
                >
                  {tH(`income.${s}`)}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 id="welcome-step" className="text-title font-semibold">{t("styleTitle")}</h2>
            <p className="mt-1 text-footnote text-muted-foreground">{t("styleHint")}</p>
            <div className="mt-4 grid gap-2" role="group" aria-labelledby="welcome-step">
              {MONEY_STYLES.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={moneyStyle === s}
                  className={cn(chip, "rounded-2xl text-start", moneyStyle === s ? chipOn : chipOff)}
                  onClick={() => setStyle(moneyStyle === s ? null : s)}
                >
                  <span className="block font-medium">{tH(`style.${s}`)}</span>
                  <span className={cn("block text-footnote", moneyStyle === s ? "opacity-90" : "text-muted-foreground")}>
                    {t(`styleExplain.${s}`)}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button disabled={saving} onClick={() => next({})}>
            {step === STEPS - 1 ? t("finish") : t("next")}
          </Button>
          {step > 0 && (
            <Button variant="ghost" disabled={saving} onClick={() => setStep(step - 1)}>
              {t("back")}
            </Button>
          )}
        </div>
      </section>
      <p className="mt-4 text-center text-footnote text-muted-foreground">{t("skipHint")}</p>
    </div>
  );
}
