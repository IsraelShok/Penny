"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
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
  "rounded-full border px-4 py-2 text-subheadline transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const chipOn = "border-primary bg-primary text-primary-foreground";
const chipOff = "border-border bg-card hover:bg-accent";

/** The 3-minute household welcome: who lives here, income shape, money style. Every step skippable. */
export function WelcomeFlow() {
  const t = useTranslations("welcome");
  const tH = useTranslations("household");
  const router = useRouter();
  const { household, loading, save, saving } = useHousehold();
  const [step, setStep] = useState(0);
  const [members, setMembers] = useState<HouseholdMember[] | null>(null);
  const [income, setIncome] = useState<IncomeShape | null | undefined>(undefined);
  const [style, setStyle] = useState<MoneyStyle | null | undefined>(undefined);

  if (loading) return <p className="text-subheadline text-muted-foreground">{t("loading")}</p>;

  const list = members ?? household.members;
  const incomeShape = income === undefined ? household.incomeShape : income;
  const moneyStyle = style === undefined ? household.moneyStyle : style;

  function next(patch: Partial<Household>) {
    const last = step === 2;
    // Send every answer so far: an earlier save may not have landed yet.
    save({ members: saveMembers(), incomeShape, moneyStyle, ...patch, ...(last && { welcomeDismissed: true }) });
    if (last) router.push("/");
    else setStep(step + 1);
  }

  function saveMembers() {
    // A member saved without a name keeps its role as the name.
    return list.map((m) => ({ ...m, name: m.name.trim() || tH(`role.${m.role}`) }));
  }

  const update = (id: string, patch: Partial<HouseholdMember>) =>
    setMembers(list.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  const thisYear = new Date().getFullYear();

  return (
    <div className="mx-auto max-w-xl">
      <p className="text-footnote text-muted-foreground" aria-live="polite">
        {t("stepOf", { step: step + 1, total: 3 })}
      </p>
      <div className="mt-2 flex gap-1.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />
        ))}
      </div>

      <section className="mt-6 rounded-2xl border border-border/60 bg-card p-5 sm:p-6" aria-labelledby="welcome-step">
        {step === 0 && (
          <>
            <h2 id="welcome-step" className="text-title3 font-semibold">{t("whoTitle")}</h2>
            <p className="mt-1 text-subheadline text-muted-foreground">{t("whoHint")}</p>
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
                    <span className="w-24 text-subheadline text-muted-foreground">{tH(`role.${m.role}`)}</span>
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

        {step === 1 && (
          <>
            <h2 id="welcome-step" className="text-title3 font-semibold">{t("incomeTitle")}</h2>
            <p className="mt-1 text-subheadline text-muted-foreground">{t("incomeHint")}</p>
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

        {step === 2 && (
          <>
            <h2 id="welcome-step" className="text-title3 font-semibold">{t("styleTitle")}</h2>
            <p className="mt-1 text-subheadline text-muted-foreground">{t("styleHint")}</p>
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

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <Button
            disabled={saving}
            onClick={() =>
              next(step === 0 ? { members: saveMembers() } : step === 1 ? { incomeShape } : { moneyStyle })
            }
          >
            {step === 2 ? t("finish") : t("next")}
          </Button>
          <Button variant="ghost" disabled={saving} onClick={() => next({})}>
            {t("skip")}
          </Button>
        </div>
      </section>
      <p className="mt-4 text-center text-footnote text-muted-foreground">{t("skipHint")}</p>
    </div>
  );
}
