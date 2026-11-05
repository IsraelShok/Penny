"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeftRight, BadgePercent, CalendarDays, Check, Copy, Globe, Landmark, LineChart, Shield, Tags, TrendingUp, X } from "lucide-react";
import { createRule, dismissSuggestion, getPlan, getSuggestions, savePlan, savePlanItem } from "@/lib/api";
import { translateCategoryName } from "@/lib/i18n-data";
import { shekels } from "@/lib/money";
import type { Suggestion } from "@/lib/suggestions";
import type { AssetInput } from "@/lib/types";
import { CardShell } from "./card-shell";
import { IconButton } from "@/components/ui/icon-button";
import { AssetDialog } from "@/components/investments/asset-dialog";

const ICONS: Record<Suggestion["type"], typeof Shield> = {
  policy: Shield, debt: Landmark, portfolio: LineChart, fees: BadgePercent, interest: AlertTriangle,
  fx: Globe, duplicate: Copy, price: TrendingUp, payday: CalendarDays, rule: Tags, fxMarkup: ArrowLeftRight,
};
/** Suggestions that only inform: confirming just clears them. */
const INFO: Suggestion["type"][] = ["fees", "interest", "fx", "duplicate", "price", "fxMarkup"];

/** What the rules noticed in your transactions, each one click to add or dismiss. Hidden when there is nothing. */
export function SuggestionsCard() {
  const t = useTranslations("suggestions");
  const tCat = useTranslations("categoriesSeeded");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["suggestions"], queryFn: getSuggestions });
  const plan = useQuery({ queryKey: ["plan"], queryFn: getPlan });
  const [dialog, setDialog] = useState<{ key: string; preset: Partial<AssetInput> } | null>(null);

  const dismiss = useMutation({
    mutationFn: (key: string) => dismissSuggestion(key),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["suggestions"] }),
  });
  const accept = useMutation({
    mutationFn: async (s: Suggestion) => {
      if (s.type === "policy") await savePlanItem("policy", { name: s.name, kind: s.policyKind, provider: null, monthlyPremium: Math.round(s.monthly) });
      if (s.type === "payday" && plan.data) await savePlan({ ...plan.data.plan, monthStartDay: s.day });
      if (s.type === "rule") await createRule({ field: "merchant", op: "equals", value: s.merchant, categoryId: s.categoryId });
      await dismissSuggestion(s.key);
    },
    onSuccess: (_, s) => {
      ["suggestions", "plan", "overview"].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
      if (!INFO.includes(s.type)) toast.success(t("added"));
    },
    onError: () => toast.error(t("failed")),
  });

  const items = query.data?.suggestions ?? [];
  if (items.length === 0) return null;

  function onAccept(s: Suggestion) {
    if (s.type === "debt") setDialog({ key: s.key, preset: { name: s.name, type: s.debtType, monthlyPayment: Math.round(s.monthly) } });
    else if (s.type === "portfolio") setDialog({ key: s.key, preset: { name: s.name, type: "stock", symbol: null, monthlyDeposit: Math.round(s.monthly) } });
    else accept.mutate(s);
  }

  const text = (s: Suggestion) => {
    switch (s.type) {
      case "policy": return t("policy", { name: s.name, amount: shekels(s.monthly, locale), kind: t(`kind_${s.policyKind}`) });
      case "debt": return t("debt", { name: s.name, amount: shekels(s.monthly, locale) });
      case "portfolio": return t("portfolio", { name: s.name, amount: shekels(s.monthly, locale) });
      case "fees": return t("fees", { amount: shekels(s.yearly, locale), count: s.count });
      case "interest": return t("interest", { amount: shekels(s.yearly, locale) });
      case "fx": return t("fx", { amount: shekels(s.yearly, locale) });
      case "duplicate": return t("duplicate", { name: s.name, amount: shekels(s.amount, locale), date: new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(new Date(`${s.date}T12:00:00`)) });
      case "price": return t("price", { name: s.name, from: shekels(s.from, locale), to: shekels(s.to, locale) });
      case "payday": return t("payday", { day: s.day });
      case "rule": return t("rule", { name: s.merchant, category: translateCategoryName(s.categoryName, tCat), count: s.count });
      case "fxMarkup": return t("fxMarkup", { amount: shekels(s.total, locale), pct: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(s.avgPct), count: s.count });
    }
  };

  return (
    <CardShell label={t("title")} className="mb-6 h-auto md:mb-8">
      <ul className="divide-y divide-border">
        {items.slice(0, 6).map((s) => {
          const Icon = ICONS[s.type];
          return (
            <li key={s.key} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted" aria-hidden>
                <Icon className="size-4" />
              </span>
              <p className="min-w-0 flex-1 text-footnote text-pretty">{text(s)}</p>
              <div className="flex shrink-0 gap-1">
                <IconButton label={INFO.includes(s.type) ? t("gotIt") : t("add")} variant={INFO.includes(s.type) ? "ghost" : "default"} size="icon-sm" disabled={accept.isPending} onClick={() => onAccept(s)}>
                  <Check className="size-4" aria-hidden />
                </IconButton>
                {!INFO.includes(s.type) && (
                  <IconButton label={t("dismiss")} size="icon-sm" onClick={() => dismiss.mutate(s.key)}>
                    <X className="size-4" aria-hidden />
                  </IconButton>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {items.length > 6 && <p className="mt-3 text-caption text-muted-foreground">{t("more", { count: items.length - 6 })}</p>}
      {dialog && (
        <AssetDialog
          asset="new"
          preset={dialog.preset}
          onClose={() => setDialog(null)}
          onSaved={() => dismiss.mutate(dialog.key)}
        />
      )}
    </CardShell>
  );
}
