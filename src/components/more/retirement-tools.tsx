"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { CardShell } from "@/components/home/card-shell";
import { NumberField, numberError } from "@/components/ui/number-field";
import { Segmented } from "@/components/ui/segmented";
import { IL } from "@/lib/il-defaults";
import { coverCheck, suggestTracks, type Risk } from "@/lib/retirement";

const num = (s: string) => { const x = Number(s); return Number.isFinite(x) ? Math.max(0, x) : 0; };
const linkCls = "font-medium text-primary underline-offset-4 hover:underline";

/** Which investment track types to look at, from age, horizon and risk. Rules of thumb, not advice. */
export function TrackHelper() {
  const t = useTranslations("retireTools");
  const tc = useTranslations("calculators");
  const [v, setV] = useState({ age: "35", retire: String(IL.pensionAge), balance: "100000" });
  const [risk, setRisk] = useState<Risk>("mid");
  const horizon = Math.max(0, num(v.retire) - num(v.age));
  const tracks = suggestTracks({ age: num(v.age), horizonYears: horizon, risk, balance: num(v.balance) });
  const field = (k: keyof typeof v, unit?: string) => (
    <NumberField id={`track-${k}`} label={t(`f_${k}`)} value={v[k]} unit={unit} onChange={(x) => setV({ ...v, [k]: x })} error={numberError(v[k], tc("invalid"))} />
  );
  return (
    <CardShell>
      <p className="text-footnote text-pretty text-muted-foreground">{t("trackIntro")}</p>
      <div className="mt-5 grid grid-cols-1 gap-4 min-[22rem]:grid-cols-3">
        {field("age")}{field("retire")}{field("balance", "₪")}
      </div>
      <fieldset className="mt-4">
        <legend className="mb-1.5 text-sm font-medium">{t("riskLabel")}</legend>
        <Segmented label={t("riskLabel")} value={risk} onChange={setRisk} options={(["low", "mid", "high"] as const).map((r) => ({ value: r, label: t(`risk_${r}`) }))} />
        <p className="mt-1.5 text-caption text-pretty text-muted-foreground">{t(`risk_${risk}_hint`)}</p>
      </fieldset>
      <div className="mt-6 rounded-2xl bg-primary/8 p-4 sm:p-5" aria-live="polite">
        <p className="text-headline font-semibold text-pretty">{t("trackHead", { years: horizon })}</p>
        <ol className="mt-3 space-y-3 text-footnote">
          {tracks.map((k, i) => (
            <li key={k} className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-caption font-semibold text-primary-foreground tabular-nums" aria-hidden>{i + 1}</span>
              <span className="min-w-0">
                <span className="block font-semibold">{t(`track_${k}`)}</span>
                <span className="block text-pretty text-muted-foreground">{t(`track_${k}_why`)}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
      <h2 className="mt-6 text-headline font-semibold">{t("feesTitle")}</h2>
      <ul className="mt-2 list-disc space-y-1.5 ps-5 text-footnote text-pretty">
        {["fees1", "fees2", "fees3"].map((k) => <li key={k}>{t(k)}</li>)}
      </ul>
      <p className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-footnote">
        <Link href="/learn/investment-tracks" className={linkCls}>{t("trackGuide")}</Link>
        <Link href="/calculators/fees" className={linkCls}>{t("feesCalc")}</Link>
      </p>
      <p className="mt-4 text-caption text-muted-foreground">{tc("notAdvice")}</p>
    </CardShell>
  );
}

const STEPS = ["step1", "step2", "step3", "step4"] as const;

/**
 * The clearing house gives individuals a one-off snapshot report (PDF), not a stable machine-readable file,
 * so this walks through getting it and copying the few numbers that matter, plus a cover check.
 */
export function ClearingHouseGuide() {
  const t = useTranslations("retireTools");
  const tc = useTranslations("calculators");
  const [disability, setDisability] = useState("75");
  const [dependents, setDependents] = useState<"yes" | "no">("yes");
  const [survivors, setSurvivors] = useState<"yes" | "no">("yes");
  const notes = coverCheck({ disabilityPct: num(disability), hasDependents: dependents === "yes", survivorsCovered: survivors === "yes" });
  const yesNo = (value: "yes" | "no", set: (v: "yes" | "no") => void, label: string) => (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <Segmented label={label} value={value} onChange={set} options={[{ value: "yes" as const, label: t("yes") }, { value: "no" as const, label: t("no") }]} />
    </fieldset>
  );
  return (
    <div className="space-y-4">
      <CardShell>
        <p className="text-footnote text-pretty text-muted-foreground">{t("chIntro")}</p>
        <ol className="mt-4 space-y-4">
          {STEPS.map((k, i) => (
            <li key={k} className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-caption font-semibold text-primary-foreground tabular-nums" aria-hidden>{i + 1}</span>
              <div className="min-w-0 text-footnote">
                <h2 className="font-semibold">{t(`${k}_title`)}</h2>
                <p className="mt-0.5 text-pretty text-muted-foreground">{t(`${k}_body`)}</p>
                {k === "step1" && <a href="https://www.swiftness.co.il" target="_blank" rel="noopener noreferrer" className={`mt-1 inline-block ${linkCls}`}>{t("step1_link")}</a>}
                {k === "step3" && <Link href="/investments" className={`mt-1 inline-block ${linkCls}`}>{t("step3_link")}</Link>}
                {k === "step4" && <Link href="/calculators/fees" className={`mt-1 inline-block ${linkCls}`}>{t("step4_link")}</Link>}
              </div>
            </li>
          ))}
        </ol>
      </CardShell>
      <CardShell label={t("coverTitle")}>
        <p className="text-footnote text-pretty text-muted-foreground">{t("coverIntro")}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <NumberField id="cover-disability" label={t("f_disability")} unit="%" value={disability} onChange={setDisability} error={numberError(disability, tc("invalid"))} />
          {yesNo(dependents, setDependents, t("f_dependents"))}
          {yesNo(survivors, setSurvivors, t("f_survivors"))}
        </div>
        <ul className="mt-5 space-y-2 rounded-2xl bg-primary/8 p-4 text-footnote text-pretty sm:p-5" aria-live="polite">
          {notes.map((k) => <li key={k}>{t(`cover_${k}`)}</li>)}
        </ul>
        <p className="mt-4 text-caption text-muted-foreground">{tc("notAdvice")}</p>
      </CardShell>
    </div>
  );
}
