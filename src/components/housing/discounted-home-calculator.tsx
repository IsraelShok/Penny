"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { NumField } from "@/components/ui/num-field";
import { DISCOUNTED_HOME_DEFAULTS, discountedVsMarket, type DiscountedHomeInputs, type HomePath } from "@/lib/discounted-home";
import { shekels } from "@/lib/money";

const pct = (v: number) => Math.round(v * 10000) / 100;

export function DiscountedHomeCalculator() {
  const t = useTranslations("discountedHome");
  const locale = useLocale();
  const [v, setV] = useState<DiscountedHomeInputs>(DISCOUNTED_HOME_DEFAULTS);
  const r = discountedVsMarket(v);
  const set = (patch: Partial<DiscountedHomeInputs>) => setV({ ...v, ...patch });
  const money = (n: number) => shekels(n, locale);
  const field = (key: keyof DiscountedHomeInputs, opts: { percent?: boolean; step?: number; max?: number; min?: number } = {}) => (
    <NumField
      id={`dh-${key}`}
      label={t(`in.${key}`)}
      value={opts.percent ? pct(v[key]) : v[key]}
      step={opts.step}
      min={opts.min}
      max={opts.max}
      onChange={(n) => set({ [key]: opts.percent ? n / 100 : n })}
    />
  );

  const better = r.diff >= 0 ? "discounted" : "market";

  return (
    <div className="space-y-6">
      <section aria-labelledby="dh-apartment" className="rounded-2xl bg-card p-5 sm:p-6">
        <h2 id="dh-apartment" className="mb-4 text-headline font-semibold">{t("apartmentTitle")}</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {field("marketPrice", { step: 50_000 })}
          {field("equity", { step: 10_000 })}
          {field("horizon", { min: 1, max: 30 })}
          {field("appreciation", { percent: true, step: 0.5, min: -10 })}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section aria-labelledby="dh-program" className="rounded-2xl bg-card p-5 sm:p-6">
          <h2 id="dh-program" className="mb-4 text-headline font-semibold">{t("programTitle")}</h2>
          <div className="grid grid-cols-2 gap-4">
            {field("discountPct", { percent: true, max: 100 })}
            {field("discountCap", { step: 10_000 })}
            {field("yearsToKeys", { max: 10, step: 0.5 })}
            {field("rent", { step: 100 })}
          </div>
          <details className="mt-4">
            <summary className="cursor-pointer rounded-lg py-2 text-sm font-medium text-primary focus-visible:outline-2 focus-visible:outline-ring">{t("moreAssumptions")}</summary>
            <div className="mt-3 grid grid-cols-2 gap-4">
              {field("linkedShare", { percent: true, max: 100, step: 5 })}
              {field("indexRate", { percent: true, step: 0.5 })}
              {field("rentGrowth", { percent: true, step: 0.5 })}
            </div>
          </details>
        </section>
        <section aria-labelledby="dh-mortgage" className="rounded-2xl bg-card p-5 sm:p-6">
          <h2 id="dh-mortgage" className="mb-4 text-headline font-semibold">{t("mortgageTitle")}</h2>
          <div className="grid grid-cols-2 gap-4">
            {field("mortgageRate", { percent: true, step: 0.25 })}
            {field("mortgageYears", { min: 1, max: 30 })}
          </div>
        </section>
      </div>

      <section aria-labelledby="dh-result" aria-live="polite" className="rounded-2xl bg-card p-5 sm:p-6">
        <h2 id="dh-result" className="mb-1 text-headline font-semibold">{t("resultTitle", { years: r.horizon })}</h2>
        <p className="mb-5 text-sm text-pretty">
          {Math.abs(r.diff) < 1_000 ? t("same") : t(`verdict_${better}`, { amount: money(Math.abs(r.diff)) })}
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <PathCard title={t("discountedTitle")} p={r.discounted} best={better === "discounted"} extra={[
            [t("discount"), money(r.discount)],
            [t("indexation"), money(r.indexation)],
            [t("rentPaid"), money(r.discounted.rentPaid)],
          ]} />
          <PathCard title={t("marketTitle")} p={r.market} best={better === "market"} extra={[]} />
        </div>
        <div className="mt-5 rounded-xl bg-emerald-500/10 p-4 text-sm text-pretty">
          <p>{t("tip")}</p>
          <Link href="/investments" className="mt-2 inline-flex min-h-11 items-center font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring">
            {t("investLink")}
          </Link>
        </div>
        <p className="mt-4 text-footnote text-muted-foreground">{t("disclaimer")}</p>
      </section>
    </div>
  );

  function PathCard({ title, p, best, extra }: { title: string; p: HomePath; best: boolean; extra: [string, string][] }) {
    const rows: [string, string][] = [
      [t("price"), money(p.price)],
      ...extra,
      [t("purchaseTax"), money(p.purchaseTax)],
      [t("loan"), money(p.loan)],
      [t("monthlyPayment"), money(p.monthlyPayment)],
      [t("interestPaid"), money(p.interestPaid)],
      [t("homeValue"), money(p.homeValue)],
      [t("mortgageLeft"), money(p.mortgageLeft)],
    ];
    return (
      <div className={`rounded-xl border p-4 ${best ? "border-emerald-500/60 bg-emerald-500/5" : "border-border/60"}`}>
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h3 className="font-semibold">{title}</h3>
          {best && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-footnote font-medium text-emerald-700 dark:text-emerald-300">{t("better")}</span>}
        </div>
        <p className="text-footnote text-muted-foreground">{t("position")}</p>
        <p className="mb-3 text-2xl font-semibold tabular-nums">{money(p.position)}</p>
        <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
          {rows.map(([k, val]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="tabular-nums">{val}</dd>
            </div>
          ))}
        </dl>
      </div>
    );
  }
}
