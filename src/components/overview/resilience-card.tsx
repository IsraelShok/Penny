"use client";

import { WhatIs } from "@/components/help/what-is";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { getResilience } from "@/lib/api";
import { usePlan } from "@/hooks/use-plan";
import { useGentle } from "@/hooks/use-gentle";
import { CardShell } from "@/components/home/card-shell";
import { Skeleton } from "@/components/ui/skeleton";

const BAND_COLOR = { building: "var(--chart-4)", steady: "var(--chart-1)", strong: "var(--status-on-track, var(--chart-3))" } as const;

/** Resilience score and Age of Money: one compact card, band in words so color is never the only signal. */
export function ResilienceCard() {
  const t = useTranslations("resilience");
  const gentle = useGentle();
  const simple = usePlan().plan.simpleMode || gentle;
  const { data, isError } = useQuery({ queryKey: ["resilience"], queryFn: getResilience });
  if (isError) return null;
  if (!data) return <Skeleton className="h-28 rounded-2xl" />;
  // Nothing to suggest when every factor is already full.
  const room = data.score < 100;
  const r = 26;
  const c = 2 * Math.PI * r;

  return (
    <CardShell>
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 64 64" className="size-16 shrink-0 -rotate-90" role="img" aria-label={t("scoreLabel", { score: data.score })}>
          <circle cx="32" cy="32" r={r} fill="none" stroke="var(--muted)" strokeWidth="7" />
          <circle
            cx="32" cy="32" r={r} fill="none" stroke={BAND_COLOR[data.band]} strokeWidth="7" strokeLinecap="round"
            strokeDasharray={`${(data.score / 100) * c} ${c}`}
          />
          <text x="32" y="32" className="rotate-90 fill-foreground text-[18px] font-semibold tabular-nums" style={{ transformOrigin: "32px 32px" }} textAnchor="middle" dominantBaseline="central">
            {data.score}
          </text>
        </svg>
        <div className="min-w-0 space-y-1">
          <p className="text-headline font-semibold">
            {t("title")} <WhatIs concept="resilience" /> · <span>{t(`band_${data.band}`)}</span>
          </p>
          <p className="text-footnote text-muted-foreground">{t(`sentence_${data.band}`)}</p>
          {room && <p className="text-footnote">
            <span className="font-medium">{t("nextStep")}</span> {t(`next_${data.weakest}`)}
          </p>}
        </div>
      </div>

      {data.ageOfMoney != null && (
        <p className="mt-4 border-t border-border/60 pt-3 text-footnote">
          <span className="font-semibold tabular-nums">{t("ageOfMoney", { days: data.ageOfMoney })}</span>
          <span className="block text-caption text-muted-foreground">{t("ageOfMoneyHint")}</span>
        </p>
      )}

      {!simple && (
        <details className="mt-3 text-footnote">
          <summary className="min-h-11 cursor-pointer content-center font-medium text-primary">{t("howTitle")}</summary>
          <ul className="mt-1 space-y-1.5">
            {data.factors.map((f) => (
              <li key={f.key} className="flex items-baseline justify-between gap-3">
                <span>
                  {t(`factor_${f.key}`)}
                  {room && f.key === data.weakest && <span className="ms-1.5 text-caption text-muted-foreground">({t("weakest")})</span>}
                </span>
                <span className="shrink-0 tabular-nums" dir="ltr">{f.points} / {f.max}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-caption text-muted-foreground">{t("howHint")}</p>
        </details>
      )}
    </CardShell>
  );
}
