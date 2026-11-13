"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { CardShell } from "@/components/home/card-shell";
import { getAssets } from "@/lib/api";
import { allocate, EMERGENCY_MONTHS, liquidCash } from "@/lib/allocation";
import { Segmented } from "@/components/ui/segmented";
import { shekels } from "@/lib/money";
import type { NeedType } from "@/lib/types";

const COLORS = { liquid: "var(--chart-3)", moneyMarket: "var(--chart-2)", market: "var(--chart-1)" } as const;

/** The 50/30/20 targets for the average month of this period, and where the surplus should go. */
export function AllocationCard({ income, expenses, byNeed, fixed }: { income: number; expenses: number; byNeed: Record<NeedType, number>; fixed: number }) {
  const t = useTranslations("allocation");
  const locale = useLocale();
  const assets = useQuery({ queryKey: ["assets"], queryFn: getAssets });
  // Per-browser preference: how big an emergency fund to aim for. The card renders client-side only after data loads.
  const [months, setMonths] = useState(() => {
    try { const v = Number(localStorage.getItem("emergency-months")); return v === 3 || v === 6 ? v : EMERGENCY_MONTHS; } catch { return EMERGENCY_MONTHS; }
  });
  const pickMonths = (v: string) => { setMonths(Number(v)); try { localStorage.setItem("emergency-months", v); } catch {} };
  if (income <= 0) return null;
  const liquidNow = liquidCash(assets.data?.assets ?? []);
  const a = allocate({ income, expenses, liquidNow, emergencyMonths: months });
  const fixedShare = fixed / income;
  const $ = (n: number) => shekels(n, locale);

  return (
    <CardShell label={t("title")}>
      <p className="text-footnote text-pretty text-muted-foreground">{t("intro", { income: $(income), expenses: $(expenses) })}</p>

      <table className="mt-4 w-full text-footnote tabular-nums">
        <thead className="text-caption text-muted-foreground">
          <tr>
            <th className="pb-1 text-start font-normal">{t("bucket")}</th>
            <th className="pb-1 text-end font-normal">{t("target")}</th>
            <th className="pb-1 text-end font-normal">{t("actual")}</th>
          </tr>
        </thead>
        <tbody>
          {(["need", "want", "saving"] as const).map((k) => {
            const actual = k === "saving" ? a.surplus : byNeed[k];
            const off = k === "saving" ? actual < a.targets[k] : actual > a.targets[k];
            return (
              <tr key={k} className="border-t border-border">
                <td className="py-2">{t(`b_${k}`)}</td>
                <td className="py-2 text-end">{$(a.targets[k])}</td>
                <td className={`py-2 text-end font-semibold ${off ? "text-[var(--status-heads-up)]" : ""}`}>
                  {$(actual)}
                  {off && <span className="ms-1 text-caption font-normal">· {t("offTarget")}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className={`mt-3 text-footnote ${fixedShare > 0.6 ? "text-[var(--status-heads-up)]" : "text-muted-foreground"}`}>
        {t(fixedShare > 0.6 ? "fixedHigh" : "fixed", { pct: Math.round(fixedShare * 100) })}
      </p>

      <p className="mt-5 text-footnote font-semibold">{t("monthlyTitle", { amount: $(a.surplus) })}</p>
      {a.surplus > 0 ? (
        <ul className="mt-2 space-y-2">
          {(["liquid", "moneyMarket", "market"] as const).map((k) => (
            <li key={k} className="flex items-baseline justify-between gap-3 text-footnote">
              <span className="inline-flex items-baseline gap-2">
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLORS[k] }} aria-hidden />
                <span>
                  {t(`to_${k}`)}
                  <span className="block text-caption text-muted-foreground">{t(`why_${k}`)}</span>
                </span>
              </span>
              <span className="font-semibold tabular-nums">{$(a.monthly[k])}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-footnote text-muted-foreground">{t("noSurplus")}</p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2 text-footnote">
        <span>{t("emergencySize")}</span>
        <Segmented label={t("emergencySize")} value={String(months)} onChange={pickMonths} options={[{ value: "3", label: t("m3") }, { value: "6", label: t("m6") }]} />
      </div>
      <p className="mt-2 text-footnote">
        {t("emergency", { goal: $(a.hold.emergency), months, liquid: $(a.hold.liquid), mm: $(a.hold.moneyMarket) })}{" "}
        <span className="text-muted-foreground">
          {a.monthsToFull === 0 ? t("full") : a.monthsToFull == null ? t("never") : t("eta", { covered: a.coveredMonths.toFixed(1), n: a.monthsToFull })}
        </span>
      </p>
      <p className="mt-3 text-caption text-pretty text-muted-foreground">{t("payFirst")}</p>
      <p className="mt-2 text-caption text-pretty text-muted-foreground">{t("disclaimer")}</p>
    </CardShell>
  );
}
