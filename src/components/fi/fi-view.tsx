"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { getFi } from "@/lib/api";
import { carCost, fiNumber, yearsToTarget, type CarInputs } from "@/lib/fi";
import { translateCategoryName } from "@/lib/i18n-data";
import { CardShell } from "@/components/home/card-shell";
import { RotateCw } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { FiPayload } from "@/lib/types";
import { FiExtras } from "./fi-extras";

const RATES = [0.04, 0.035, 0.03];
const fmt = (n: number, locale: string, digits = 0) =>
  n.toLocaleString(locale === "he" ? "he-IL" : "en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
// LTR isolate keeps the sign in front of the amount inside Hebrew text.
const shekels = (n: number, locale: string) => `⁦${n < 0 ? "−" : ""}₪${fmt(Math.abs(n), locale)}⁩`;

/** Per-viewer convenience: remember what was typed. Falls back silently where storage is blocked. */
function useStored<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read once after hydration
      if (raw) setValue({ ...initial, ...JSON.parse(raw) });
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return [
    value,
    (v: T) => {
      setValue(v);
      try {
        localStorage.setItem(key, JSON.stringify(v));
      } catch {}
    },
  ];
}

export function FiView() {
  const t = useTranslations("fi");
  const query = useQuery({ queryKey: ["fi"], queryFn: getFi });
  if (query.isError) {
    return (
      <CardShell>
        <p className="text-footnote text-muted-foreground">{t("loadFailed")}</p>
        <IconButton label={t("retry")} variant="outline" className="mt-3 self-start" onClick={() => query.refetch()}><RotateCw className="size-4" aria-hidden /></IconButton>
      </CardShell>
    );
  }
  if (!query.data) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-64 rounded-[1.375rem] md:col-span-2" />
        <Skeleton className="h-64 rounded-[1.375rem]" />
      </div>
    );
  }
  return <Body data={query.data} />;
}

interface Plan {
  spend: string;
  income: string;
  savings: string;
  returnPct: string;
  rate: number;
}

function Body({ data }: { data: FiPayload }) {
  const t = useTranslations("fi");
  const locale = useLocale();
  // Empty fields fall back to the figures from your own data.
  const [plan, setPlan] = useStored<Plan>("fi-plan", { spend: "", income: "", savings: "", returnPct: "5", rate: 0.04 });
  const set = (k: keyof Plan, v: string | number) => setPlan({ ...plan, [k]: v });
  const num = (s: string, fallback: number) => (s.trim() === "" || !Number.isFinite(Number(s)) ? fallback : Number(s));

  const spend = num(plan.spend, Math.round(data.monthlyExpenses));
  const income = num(plan.income, Math.round(data.monthlyIncome));
  const savings = num(plan.savings, Math.round(Math.max(0, data.liquidNetWorth)));
  const annualReturn = num(plan.returnPct, 5) / 100;
  const target = fiNumber(spend * 12, plan.rate);
  const monthlySaving = income - spend;
  const years = yearsToTarget(savings, Math.max(0, monthlySaving), annualReturn, target);
  const progress = target > 0 && Number.isFinite(target) ? Math.min(1, Math.max(0, savings / target)) : 0;
  const savingsRate = income > 0 ? monthlySaving / income : null;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <CardShell wallet label={t("heroLabel")} className="lg:col-span-2">
        <p className="figure text-[3.5rem] leading-none">
          {years == null ? t("never") : years === 0 ? t("already") : t("years", { years: fmt(years, locale, 1) })}
        </p>
        <p className="mt-3 text-footnote text-muted-foreground">
          {years == null
            ? t("neverHint")
            : t("heroHint", { target: shekels(target, locale), rate: Math.round(plan.rate * 1000) / 10 })}
        </p>
        <div className="mt-8">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} aria-label={t("progressLabel")}>
            <div className="h-full rounded-full bg-foreground" style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-caption text-muted-foreground tabular-nums">
            <span>{t("youHave", { amount: shekels(savings, locale), pct: Math.round(progress * 100) })}</span>
            <span>{shekels(target, locale)}</span>
          </div>
        </div>
        <dl className="mt-8 grid grid-cols-3 gap-6">
          <Stat label={t("savingsRate")} value={savingsRate == null ? "—" : `${Math.round(savingsRate * 100)}%`} />
          <Stat label={t("yearsOfLiving")} value={spend > 0 ? fmt(savings / (spend * 12), locale, 1) : "—"} hint={t("yearsOfLivingHint")} />
          <Stat label={t("safeWithdrawal")} value={shekels((savings * plan.rate) / 12, locale)} hint={t("safeWithdrawalHint")} />
        </dl>
      </CardShell>

      <CardShell label={t("assumptions")}>
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <Field id="fi-spend" label={t("monthlySpend")} value={plan.spend} placeholder={fmt(data.monthlyExpenses, locale)} onChange={(v) => set("spend", v)} />
          <Field id="fi-income" label={t("monthlyIncome")} value={plan.income} placeholder={fmt(data.monthlyIncome, locale)} onChange={(v) => set("income", v)} />
          <Field id="fi-savings" label={t("invested")} value={plan.savings} placeholder={fmt(Math.max(0, data.liquidNetWorth), locale)} onChange={(v) => set("savings", v)} />
          <Field id="fi-return" label={t("expectedReturn")} value={plan.returnPct} onChange={(v) => set("returnPct", v)} suffix="%" />
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">{t("withdrawalRate")}</legend>
            <div className="inline-flex rounded-xl bg-muted p-1" role="radiogroup">
              {RATES.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={plan.rate === r}
                  onClick={() => set("rate", r)}
                  className={cn("min-h-8 rounded-lg px-3 text-footnote font-medium tabular-nums", plan.rate === r ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                >
                  {Math.round(r * 1000) / 10}%
                </button>
              ))}
            </div>
          </fieldset>
          <p className="text-caption text-pretty text-muted-foreground">
            {t("dataNote", { months: data.monthsOfData })}
            {!data.hasAssets && <> {t("noAssetsNote")}</>}
          </p>
        </form>
      </CardShell>

      <AggressiveSaving spend={spend} income={income} savings={savings} annualReturn={annualReturn} rate={plan.rate} />
      <Inflation data={data.inflation} />
      <CarCalculator rate={plan.rate} />
      <FiExtras data={data} />
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div title={hint}>
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="figure mt-1 text-[1.75rem] leading-tight">{value}</dd>
    </div>
  );
}

function Field({ id, label, value, placeholder, onChange, suffix }: { id: string; label: string; value: string; placeholder?: string; onChange: (v: string) => void; suffix?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input id={id} type="number" inputMode="decimal" step="any" min="0" dir="ltr" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={suffix ? "pr-8" : undefined} />
        {suffix && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-footnote text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

function AggressiveSaving({ spend, income, savings, annualReturn, rate }: { spend: number; income: number; savings: number; annualReturn: number; rate: number }) {
  const t = useTranslations("fi");
  const locale = useLocale();
  const [cut, setCut] = useState(1000);
  const after = Math.max(0, spend - cut);
  const before = { target: fiNumber(spend * 12, rate), years: yearsToTarget(savings, Math.max(0, income - spend), annualReturn, fiNumber(spend * 12, rate)) };
  const next = { target: fiNumber(after * 12, rate), years: yearsToTarget(savings, Math.max(0, income - after), annualReturn, fiNumber(after * 12, rate)) };
  const yearsText = (y: number | null) => (y == null ? t("never") : y === 0 ? t("already") : t("years", { years: fmt(y, locale, 1) }));

  return (
    <CardShell label={t("cutTitle")}>
      <Label htmlFor="fi-cut">{t("cutLabel", { amount: shekels(cut, locale) })}</Label>
      <input
        id="fi-cut"
        type="range"
        min={0}
        max={Math.max(500, Math.round(spend / 2 / 100) * 100)}
        step={100}
        value={cut}
        onChange={(e) => setCut(Number(e.target.value))}
        className="mt-3 w-full accent-[var(--foreground)]"
      />
      <dl className="mt-5 space-y-3 text-footnote">
        <Row label={t("yourNumber")} before={shekels(before.target, locale)} after={shekels(next.target, locale)} />
        <Row label={t("timeToFi")} before={yearsText(before.years)} after={yearsText(next.years)} />
      </dl>
      <p className="mt-4 text-footnote">
        {t("cutResult", { factor: Math.round(12 / rate), amount: shekels(before.target - next.target, locale) })}
      </p>
    </CardShell>
  );
}

function Row({ label, before, after }: { label: string; before: string; after: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">
        <span className="text-muted-foreground line-through decoration-1">{before}</span>
        <span className="ms-2 font-semibold">{after}</span>
      </dd>
    </div>
  );
}

function Inflation({ data }: { data: FiPayload["inflation"] }) {
  const t = useTranslations("fi");
  const tCat = useTranslations("categoriesSeeded");
  const pct = (n: number) => `${n >= 0 ? "+" : "−"}${(Math.abs(n) * 100).toFixed(1)}%`;
  return (
    <CardShell label={t("inflationTitle")}>
      {data.rate == null ? (
        <p className="text-footnote text-muted-foreground">{t("inflationEmpty")}</p>
      ) : (
        <>
          <p className="figure text-[2.5rem] leading-none" dir="ltr">{pct(data.rate)}</p>
          <p className="mt-2 text-caption text-muted-foreground">{t("inflationHint")}</p>
          <ul className="mt-5 space-y-2">
            {data.categories.slice(0, 6).map((c) => (
              <li key={c.categoryId} className="flex items-baseline justify-between gap-3 text-footnote">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: c.color }} aria-hidden />
                  <span className="truncate">{translateCategoryName(c.name, tCat)}</span>
                </span>
                <span className={cn("shrink-0 font-medium tabular-nums", c.change > 0 ? "text-status-over" : "text-status-on-track")} dir="ltr">{pct(c.change)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </CardShell>
  );
}

const CAR_FIELDS: (keyof CarInputs)[] = ["purchasePrice", "currentValue", "kmDriven", "kmPerYear", "kmPerLiter", "fuelPrice", "annualTest", "annualInsurance", "annualMaintenance"];

function CarCalculator({ rate }: { rate: number }) {
  const t = useTranslations("fi");
  const locale = useLocale();
  const [car, setCar] = useStored<Record<keyof CarInputs, string>>("fi-car", {
    purchasePrice: "", currentValue: "", kmDriven: "", kmPerYear: "", kmPerLiter: "", fuelPrice: "7.2", annualTest: "", annualInsurance: "", annualMaintenance: "",
  });
  const values = Object.fromEntries(CAR_FIELDS.map((k) => [k, Number(car[k]) || 0])) as unknown as CarInputs;
  const result = carCost(values);

  return (
    <CardShell label={t("carTitle")}>
      <div className="grid grid-cols-2 gap-3">
        {CAR_FIELDS.map((k) => (
          <Field key={k} id={`car-${k}`} label={t(`car_${k}`)} value={car[k]} onChange={(v) => setCar({ ...car, [k]: v })} />
        ))}
      </div>
      {result && result.perYear > 0 ? (
        <div className="mt-5 space-y-1">
          <p className="figure text-[2rem] leading-tight">{t("carPerYear", { amount: shekels(result.perYear, locale) })}</p>
          <p className="text-footnote text-muted-foreground">
            {t("carDetail", { perKm: fmt(result.perKm, locale, 2), years: fmt(result.years, locale, 1), fi: shekels(fiNumber(result.perYear, rate), locale) })}
          </p>
        </div>
      ) : (
        <p className="mt-5 text-footnote text-muted-foreground">{t("carEmpty")}</p>
      )}
    </CardShell>
  );
}
