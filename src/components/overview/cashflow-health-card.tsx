"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";
import { getCashflowHealth } from "@/lib/api";
import { CardShell } from "@/components/home/card-shell";

const LOOK = {
  healthy: { Icon: CircleCheck, color: "var(--status-on-track)" },
  watch: { Icon: TriangleAlert, color: "var(--status-heads-up)" },
  problem: { Icon: CircleAlert, color: "var(--destructive)" },
} as const;

/** Cash-flow warning signs: level in words and an icon, so color is never the only signal. Hidden until there is data. */
export function CashflowHealthCard() {
  const t = useTranslations("cashflowHealth");
  const { data } = useQuery({ queryKey: ["cashflow-health"], queryFn: getCashflowHealth });
  if (!data?.hasData) return null;
  const { Icon, color } = LOOK[data.level];
  return (
    <CardShell label={t("title")}>
      <p className="flex items-center gap-2 text-body font-semibold">
        <Icon className="size-5 shrink-0" style={{ color }} aria-hidden />
        {t(`level_${data.level}`, { n: data.signs.length })}
      </p>
      {data.signs.length > 0 && (
        <ul className="mt-3 space-y-2">
          {data.signs.map((s) => (
            <li key={s} className="text-footnote">
              <span className="font-medium">{t(`sign_${s}`)}</span>
              <span className="block text-caption text-muted-foreground">{t(`fix_${s}`)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-caption text-pretty text-muted-foreground">{t("hint")}</p>
    </CardShell>
  );
}
