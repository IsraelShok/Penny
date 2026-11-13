"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { getOverview } from "@/lib/api";
import { confetti } from "@/lib/confetti";
import { shekels } from "@/lib/money";

/**
 * Once per month: if last month ended with more income than spending, celebrate it
 * (confetti + a note) and nudge the surplus toward savings or investing.
 */
export function MonthCelebration() {
  const t = useTranslations("celebrate");
  const locale = useLocale();
  const router = useRouter();
  const last = useQuery({ queryKey: ["overview", "month", 1], queryFn: () => getOverview("month", 1) });
  const data = last.data;

  useEffect(() => {
    if (!data) return;
    const { income, net } = data.totals;
    if (income <= 0 || net <= 0) return;
    const key = `penny-celebrated-${data.period.from.slice(0, 7)}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      return; // no storage: better no party than one on every visit
    }
    const month = new Intl.DateTimeFormat(locale, { month: "long" }).format(new Date(`${data.period.from}T12:00:00`));
    confetti();
    toast.success(t("title", { month, amount: shekels(net, locale) }), {
      description: t("body", { pct: Math.round((net / income) * 100) }),
      duration: 12000,
      action: { label: t("action"), onClick: () => router.push("/overview?tab=period") },
    });
  }, [data, locale, router, t]);

  return null;
}
