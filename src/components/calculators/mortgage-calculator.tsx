"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { NumField } from "@/components/ui/num-field";
import { Segmented } from "@/components/ui/segmented";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LIMITS,
  MORTGAGE_DEFAULTS,
  mortgage,
  prepayFee,
  prepayVsInvest,
  type Buyer,
  type MortgageInputs,
  type Track,
  type TrackKind,
} from "@/lib/mortgage";
import { shekels } from "@/lib/money";
import { IL } from "@/lib/il-defaults";

const KINDS: TrackKind[] = ["prime", "fixed", "fixedLinked", "var5", "var5Linked"];
/** Example starting rates per track when you switch kind; prime is the spread. Not offers. */
const RATE: Record<TrackKind, number> = {
  prime: -0.5,
  fixed: 5,
  fixedLinked: 3.3,
  var5: 4.6,
  var5Linked: 3,
};
const BUYERS: Buyer[] = ["first", "upgrade", "investor"];
const pct = (v: number) => Math.round(v * 10000) / 100;

export function MortgageCalculator() {
  const t = useTranslations("calculators.mortgageCalc");
  const tc = useTranslations("calculators");
  const locale = useLocale();
  const [v, setV] = useState<MortgageInputs>(MORTGAGE_DEFAULTS);
  const m = mortgage(v);
  const money = (n: number) => shekels(n, locale);
  const set = (patch: Partial<MortgageInputs>) => setV({ ...v, ...patch });
  const setTrack = (i: number, patch: Partial<Track>) =>
    set({ tracks: v.tracks.map((tr, j) => (j === i ? { ...tr, ...patch } : tr)) });

  const warnings = [
    m.warnings.shares && t("warnShares", { total: pct(m.shareTotal) }),
    m.warnings.fixed && t("warnFixed", { min: Math.round(LIMITS.minFixedShare * 100) }),
    m.warnings.ltv &&
      t("warnLtvBuyer", {
        ltv: Math.round(m.ltv * 100),
        max: Math.round(LIMITS.ltv[v.buyer] * 100),
        buyer: t(`buyer.${v.buyer}`),
      }),
    m.warnings.pti === "over" && t("warnPtiOver", { pti: Math.round(m.pti * 100) }),
    m.warnings.pti === "high" && t("warnPtiHigh", { pti: Math.round(m.pti * 100) }),
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-6">
      <section aria-labelledby="mg-basics" className="rounded-2xl bg-card p-5 sm:p-6">
        <h2 id="mg-basics" className="mb-4 text-headline font-semibold">
          {t("basics")}
        </h2>
        <div className="mb-4">
          <Segmented
            label={t("buyerLabel")}
            value={v.buyer}
            onChange={(b) => set({ buyer: b })}
            options={BUYERS.map((b) => ({ value: b, label: t(`buyer.${b}`) }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <NumField
            id="mg-loan"
            label={t("loan")}
            value={v.loan}
            step={50_000}
            onChange={(n) => set({ loan: n })}
          />
          <NumField
            id="mg-value"
            label={t("propertyValue")}
            value={v.propertyValue}
            step={50_000}
            onChange={(n) => set({ propertyValue: n })}
          />
          <NumField
            id="mg-income"
            label={t("income")}
            value={v.income}
            step={500}
            onChange={(n) => set({ income: n })}
          />
          <NumField
            id="mg-prime"
            label={t("prime")}
            value={v.primePct}
            step={0.25}
            onChange={(n) => set({ primePct: n })}
          />
          <NumField
            id="mg-infl"
            label={t("inflation")}
            value={v.inflationPct}
            step={0.25}
            onChange={(n) => set({ inflationPct: n })}
          />
          <NumField
            id="mg-shock"
            label={t("shock")}
            value={v.primeShock}
            step={0.25}
            min={-5}
            max={10}
            onChange={(n) => set({ primeShock: n })}
          />
        </div>
      </section>

      <section aria-labelledby="mg-tracks" className="rounded-2xl bg-card p-5 sm:p-6">
        <h2 id="mg-tracks" className="mb-1 text-headline font-semibold">
          {t("tracks")}
        </h2>
        <p className="mb-4 text-footnote text-muted-foreground text-pretty">{t("tracksHint")}</p>
        <ul className="space-y-4">
          {v.tracks.map((tr, i) => (
            <li key={i} className="rounded-xl border border-border/60 p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <Select
                  value={tr.kind}
                  onValueChange={(k) =>
                    k && setTrack(i, { kind: k as TrackKind, ratePct: RATE[k as TrackKind] })
                  }
                >
                  <SelectTrigger className="w-auto min-w-48" aria-label={t("trackKind")}>
                    <SelectValue>{(k: string) => t(`kind.${k}`)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {KINDS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {t(`kind.${k}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  onClick={() => set({ tracks: v.tracks.filter((_, j) => j !== i) })}
                  disabled={v.tracks.length === 1}
                  className="min-h-11 rounded-full px-3 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {t("remove")}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <NumField
                  id={`mg-share-${i}`}
                  label={t("share")}
                  value={pct(tr.share)}
                  max={100}
                  step={5}
                  onChange={(n) => setTrack(i, { share: n / 100 })}
                />
                <NumField
                  id={`mg-rate-${i}`}
                  label={t(tr.kind === "prime" ? "spread" : "rate")}
                  value={tr.ratePct}
                  step={0.1}
                  min={-5}
                  onChange={(n) => setTrack(i, { ratePct: n })}
                />
                <NumField
                  id={`mg-years-${i}`}
                  label={t("years")}
                  value={tr.years}
                  min={4}
                  max={30}
                  onChange={(n) => setTrack(i, { years: n })}
                />
              </div>
              <p className="mt-2 text-footnote text-muted-foreground">
                {t("trackLine", {
                  principal: money(m.tracks[i].principal),
                  payment: money(m.tracks[i].firstPayment),
                  cost: money(m.tracks[i].cost),
                })}
              </p>
            </li>
          ))}
        </ul>
        {v.tracks.length < 6 && (
          <button
            type="button"
            onClick={() =>
              set({ tracks: [...v.tracks, { kind: "fixed", share: 0, ratePct: 5, years: 25 }] })
            }
            className="mt-3 min-h-11 rounded-full px-3 text-sm font-medium text-primary hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
          >
            {t("add")}
          </button>
        )}
      </section>

      <section
        aria-labelledby="mg-result"
        aria-live="polite"
        className="rounded-2xl bg-card p-5 sm:p-6"
      >
        <h2 id="mg-result" className="mb-3 text-headline font-semibold">
          {t("result")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label={t("firstPayment")} value={money(m.firstPayment)} />
          <Stat label={t("maxPayment")} value={money(m.maxPayment)} />
          <Stat
            label={t("totalPaid")}
            value={money(m.totalPaid)}
            sub={t("costLine", {
              cost: money(m.cost),
              per: (m.totalPaid / Math.max(v.loan, 1)).toFixed(2),
            })}
          />
        </div>
        {warnings.length > 0 && (
          <ul className="mt-5 space-y-2">
            {warnings.map((w) => (
              <li key={w} className="flex gap-2 rounded-xl bg-amber-500/10 p-3 text-sm text-pretty">
                <AlertTriangle
                  className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
                  aria-hidden
                />
                {w}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-5 text-sm text-pretty">{t("tip")}</p>
        <p className="mt-4 text-footnote text-muted-foreground">
          {t("disclaimer")} {tc("disclaimer")}
        </p>
      </section>

      <PayEarly />
    </div>
  );
}

/** Early repayment: the fee estimate, then prepaying versus investing the same lump. */
function PayEarly() {
  const t = useTranslations("calculators.mortgageCalc");
  const locale = useLocale();
  const money = (n: number) => shekels(n, locale);
  const [p, setP] = useState({
    amount: 100_000,
    ratePct: 5,
    marketRatePct: 4.5,
    years: 20,
    resetMonths: 0,
    returnPct: 5,
  });
  const set = (patch: Partial<typeof p>) => setP({ ...p, ...patch });
  const fee = prepayFee({
    amount: p.amount,
    ratePct: p.ratePct,
    marketRatePct: p.marketRatePct,
    monthsLeft: p.years * 12,
    horizonMonths: p.resetMonths || undefined,
  });
  const cmp = prepayVsInvest({
    amount: p.amount,
    fee,
    ratePct: p.ratePct,
    years: p.years,
    returnPct: p.returnPct,
    taxRate: IL.capitalGainsTax,
  });
  return (
    <section aria-labelledby="mg-early" className="rounded-2xl bg-card p-5 sm:p-6">
      <h2 id="mg-early" className="mb-1 text-headline font-semibold">
        {t("early.title")}
      </h2>
      <p className="mb-4 text-footnote text-muted-foreground text-pretty">{t("early.hint")}</p>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <NumField
          id="pe-amount"
          label={t("early.amount")}
          value={p.amount}
          step={10_000}
          onChange={(n) => set({ amount: n })}
        />
        <NumField
          id="pe-rate"
          label={t("early.rate")}
          value={p.ratePct}
          step={0.1}
          onChange={(n) => set({ ratePct: n })}
        />
        <NumField
          id="pe-market"
          label={t("early.market")}
          value={p.marketRatePct}
          step={0.1}
          onChange={(n) => set({ marketRatePct: n })}
        />
        <NumField
          id="pe-years"
          label={t("early.years")}
          value={p.years}
          min={1}
          max={30}
          onChange={(n) => set({ years: n })}
        />
        <NumField
          id="pe-reset"
          label={t("early.reset")}
          value={p.resetMonths}
          max={60}
          onChange={(n) => set({ resetMonths: n })}
        />
        <NumField
          id="pe-return"
          label={t("early.return")}
          value={p.returnPct}
          step={0.5}
          min={-10}
          onChange={(n) => set({ returnPct: n })}
        />
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-3" aria-live="polite">
        <Stat label={t("early.fee")} value={money(fee)} sub={t("early.feeSub")} />
        <Stat
          label={t("early.prepay")}
          value={money(cmp.prepay)}
          sub={t("early.drop", { amount: money(cmp.monthlyDrop) })}
        />
        <Stat label={t("early.invest")} value={money(cmp.invest)} sub={t("early.afterTax")} />
      </div>
      <p className="mt-4 text-sm font-medium text-pretty">
        {t(cmp.better === "prepay" ? "early.prepayWins" : "early.investWins", {
          amount: money(Math.abs(cmp.prepay - cmp.invest)),
          years: p.years,
        })}
      </p>
      <p className="mt-3 text-footnote text-muted-foreground text-pretty">{t("early.note")}</p>
    </section>
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
