"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { NumField } from "@/components/ui/num-field";
import { Segmented } from "@/components/ui/segmented";
import { LIMITS, MORTGAGE_DEFAULTS, mortgage, type MortgageInputs, type Track, type TrackKind } from "@/lib/mortgage";
import { shekels } from "@/lib/money";

const KINDS: TrackKind[] = ["prime", "fixed", "fixedLinked"];
const pct = (v: number) => Math.round(v * 10000) / 100;

export function MortgageCalculator() {
  const t = useTranslations("calculators.mortgageCalc");
  const tc = useTranslations("calculators");
  const locale = useLocale();
  const [v, setV] = useState<MortgageInputs>(MORTGAGE_DEFAULTS);
  const m = mortgage(v);
  const money = (n: number) => shekels(n, locale);
  const set = (patch: Partial<MortgageInputs>) => setV({ ...v, ...patch });
  const setTrack = (i: number, patch: Partial<Track>) => set({ tracks: v.tracks.map((tr, j) => (j === i ? { ...tr, ...patch } : tr)) });

  const warnings = [
    m.warnings.shares && t("warnShares", { total: pct(m.shareTotal) }),
    m.warnings.fixed && t("warnFixed", { min: Math.round(LIMITS.minFixedShare * 100) }),
    m.warnings.ltv && t("warnLtv", { ltv: Math.round(m.ltv * 100), max: LIMITS.ltv * 100 }),
    m.warnings.pti === "over" && t("warnPtiOver", { pti: Math.round(m.pti * 100) }),
    m.warnings.pti === "high" && t("warnPtiHigh", { pti: Math.round(m.pti * 100) }),
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-6">
      <section aria-labelledby="mg-basics" className="rounded-2xl bg-card p-5 sm:p-6">
        <h2 id="mg-basics" className="mb-4 text-headline font-semibold">{t("basics")}</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <NumField id="mg-loan" label={t("loan")} value={v.loan} step={50_000} onChange={(n) => set({ loan: n })} />
          <NumField id="mg-value" label={t("propertyValue")} value={v.propertyValue} step={50_000} onChange={(n) => set({ propertyValue: n })} />
          <NumField id="mg-income" label={t("income")} value={v.income} step={500} onChange={(n) => set({ income: n })} />
          <NumField id="mg-prime" label={t("prime")} value={v.primePct} step={0.25} onChange={(n) => set({ primePct: n })} />
          <NumField id="mg-infl" label={t("inflation")} value={v.inflationPct} step={0.25} onChange={(n) => set({ inflationPct: n })} />
          <NumField id="mg-shock" label={t("shock")} value={v.primeShock} step={0.25} min={-5} max={10} onChange={(n) => set({ primeShock: n })} />
        </div>
      </section>

      <section aria-labelledby="mg-tracks" className="rounded-2xl bg-card p-5 sm:p-6">
        <h2 id="mg-tracks" className="mb-1 text-headline font-semibold">{t("tracks")}</h2>
        <p className="mb-4 text-footnote text-muted-foreground text-pretty">{t("tracksHint")}</p>
        <ul className="space-y-4">
          {v.tracks.map((tr, i) => (
            <li key={i} className="rounded-xl border border-border/60 p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <Segmented label={t("trackKind")} value={tr.kind} onChange={(k) => setTrack(i, { kind: k, ratePct: MORTGAGE_DEFAULTS.tracks[KINDS.indexOf(k)].ratePct })} options={KINDS.map((k) => ({ value: k, label: t(`kind.${k}`) }))} />
                <button type="button" onClick={() => set({ tracks: v.tracks.filter((_, j) => j !== i) })} disabled={v.tracks.length === 1} className="min-h-11 rounded-full px-3 text-sm text-muted-foreground hover:bg-accent disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-ring">
                  {t("remove")}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <NumField id={`mg-share-${i}`} label={t("share")} value={pct(tr.share)} max={100} step={5} onChange={(n) => setTrack(i, { share: n / 100 })} />
                <NumField id={`mg-rate-${i}`} label={t(tr.kind === "prime" ? "spread" : "rate")} value={tr.ratePct} step={0.1} min={-5} onChange={(n) => setTrack(i, { ratePct: n })} />
                <NumField id={`mg-years-${i}`} label={t("years")} value={tr.years} min={4} max={30} onChange={(n) => setTrack(i, { years: n })} />
              </div>
              <p className="mt-2 text-footnote text-muted-foreground">
                {t("trackLine", { principal: money(m.tracks[i].principal), payment: money(m.tracks[i].firstPayment), cost: money(m.tracks[i].cost) })}
              </p>
            </li>
          ))}
        </ul>
        {v.tracks.length < 6 && (
          <button type="button" onClick={() => set({ tracks: [...v.tracks, { kind: "fixed", share: 0, ratePct: 5, years: 25 }] })} className="mt-3 min-h-11 rounded-full px-3 text-sm font-medium text-primary hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring">
            {t("add")}
          </button>
        )}
      </section>

      <section aria-labelledby="mg-result" aria-live="polite" className="rounded-2xl bg-card p-5 sm:p-6">
        <h2 id="mg-result" className="mb-3 text-headline font-semibold">{t("result")}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label={t("firstPayment")} value={money(m.firstPayment)} />
          <Stat label={t("maxPayment")} value={money(m.maxPayment)} />
          <Stat label={t("totalPaid")} value={money(m.totalPaid)} sub={t("costLine", { cost: money(m.cost), per: (m.totalPaid / Math.max(v.loan, 1)).toFixed(2) })} />
        </div>
        {warnings.length > 0 && (
          <ul className="mt-5 space-y-2">
            {warnings.map((w) => (
              <li key={w} className="flex gap-2 rounded-xl bg-amber-500/10 p-3 text-sm text-pretty">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                {w}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-5 text-sm text-pretty">{t("tip")}</p>
        <p className="mt-4 text-footnote text-muted-foreground">{t("disclaimer")} {tc("disclaimer")}</p>
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-footnote text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-footnote text-muted-foreground">{sub}</p>}
    </div>
  );
}
