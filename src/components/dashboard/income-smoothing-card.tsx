"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { CardShell } from "@/components/home/card-shell";
import { InfoTip } from "@/components/ui/info-tip";
import { getIncomeSmoothing } from "@/lib/api";
import { shekels } from "@/lib/money";

/** "A steady salary to yourself" for irregular income. Hidden when income is steady. */
export function IncomeSmoothingCard() {
  const t = useTranslations("smoothing");
  const locale = useLocale();
  const { data } = useQuery({ queryKey: ["income-smoothing"], queryFn: getIncomeSmoothing });
  const s = data?.smoothing;
  if (!s) return null;
  return (
    <CardShell label={t("label")} action={<InfoTip text={`${t("sentence", { steady: shekels(s.steady, locale) })} ${t("how")}`} className="-my-3" />}>
      <dl className="grid grid-cols-2 gap-3 text-center">
        <div className="rounded-xl bg-muted/60 p-3">
          <dt className="text-xs text-muted-foreground">{t("steady")}</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums">{shekels(s.steady, locale)}</dd>
        </div>
        <div className="rounded-xl bg-muted/60 p-3">
          <dt className="text-xs text-muted-foreground">{t("buffer")}</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums">{shekels(s.bufferTarget, locale)}</dd>
        </div>
      </dl>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        {t(s.thisMonth.kind, { amount: shekels(s.thisMonth.amount, locale) })}
      </p>
    </CardShell>
  );
}
