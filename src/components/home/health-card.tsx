"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";
import { getCashflowHealth, getResilience } from "@/lib/api";
import { CardShell } from "./card-shell";
import { Skeleton } from "@/components/ui/skeleton";

const BAND_COLOR = { building: "var(--chart-4)", steady: "var(--chart-1)", strong: "var(--status-on-track, var(--chart-3))" } as const;
const CASH_ICON = { healthy: CircleCheck, watch: TriangleAlert, problem: CircleAlert } as const;

/**
 * Home's financial-health chart: the resilience score as a ring, each factor as a bar,
 * and the cash-flow warning count. Band and level are in words, so color is never the only signal.
 */
export function HealthCard() {
  const t = useTranslations("resilience");
  const tc = useTranslations("cashflowHealth");
  const th = useTranslations("health");
  const res = useQuery({ queryKey: ["resilience"], queryFn: getResilience });
  const cash = useQuery({ queryKey: ["cashflow-health"], queryFn: getCashflowHealth });
  if (res.isError) return null;
  if (!res.data) return <Skeleton className="mb-6 h-56 rounded-2xl" />;
  const d = res.data;
  const r = 44;
  const c = 2 * Math.PI * r;
  const color = BAND_COLOR[d.band];
  const CashIcon = cash.data?.hasData ? CASH_ICON[cash.data.level] : null;

  return (
    <CardShell label={th("title")} className="mb-6 h-auto md:mb-8" action={<Link href="/overview" className="-my-3.5 inline-block py-3.5 text-footnote font-medium text-primary">{th("details")}</Link>}>
      <div className="grid items-center gap-6 sm:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center gap-2">
          <svg viewBox="0 0 100 100" className="size-32 -rotate-90" role="img" aria-label={t("scoreLabel", { score: d.score })}>
            <circle cx="50" cy="50" r={r} fill="none" stroke="var(--muted)" strokeWidth="9" />
            <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${(d.score / 100) * c} ${c}`} className="motion-safe:transition-[stroke-dasharray] motion-safe:duration-700" />
            <text x="50" y="50" className="rotate-90 fill-foreground text-[26px] font-semibold tabular-nums" style={{ transformOrigin: "50px 50px" }} textAnchor="middle" dominantBaseline="central">{d.score}</text>
          </svg>
          <p className="text-footnote font-semibold">{t(`band_${d.band}`)}</p>
        </div>

        <div className="min-w-0 space-y-3">
          <ul className="space-y-2.5" aria-label={t("howTitle")}>
            {d.factors.map((f) => (
              <li key={f.key} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-footnote">
                <span className="truncate">{t(`factor_${f.key}`)}</span>
                <span className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <span className="block h-full rounded-full" style={{ width: `${(f.points / f.max) * 100}%`, backgroundColor: f.key === d.weakest && d.score < 100 ? "var(--status-heads-up)" : color }} />
                </span>
                <span className="tabular-nums text-muted-foreground" dir="ltr">{f.points}/{f.max}</span>
              </li>
            ))}
          </ul>
          {d.score < 100 && <p className="text-footnote"><span className="font-medium">{t("nextStep")}</span> {t(`next_${d.weakest}`)}</p>}
          {CashIcon && cash.data && (
            <p className="flex items-center gap-2 border-t border-border/60 pt-3 text-footnote">
              <CashIcon className="size-4 shrink-0" aria-hidden />
              {tc(`level_${cash.data.level}`, { n: cash.data.signs.length })}
            </p>
          )}
        </div>
      </div>
    </CardShell>
  );
}
