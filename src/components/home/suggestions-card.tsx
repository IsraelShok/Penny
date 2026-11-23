"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeftRight,
  BadgePercent,
  CalendarDays,
  Check,
  Copy,
  Globe,
  Landmark,
  LineChart,
  Shield,
  Tags,
  Receipt,
  TrendingUp,
  X,
  Bell,
  BellRing,
  Coffee,
  Flame,
  LifeBuoy,
  PiggyBank,
} from "lucide-react";
import {
  createRule,
  dismissSuggestion,
  getPlan,
  getSuggestions,
  savePlan,
  savePlanItem,
} from "@/lib/api";
import { translateCategoryName } from "@/lib/i18n-data";
import { shekels } from "@/lib/money";
import { gentleKey } from "@/lib/gentle";
import { useGentle } from "@/hooks/use-gentle";
import type { Suggestion } from "@/lib/suggestions";
import type { AssetInput } from "@/lib/types";
import { CardShell } from "./card-shell";
import { IconButton } from "@/components/ui/icon-button";
import { AssetDialog } from "@/components/investments/asset-dialog";

const ICONS: Record<Suggestion["type"], typeof Shield> = {
  policy: Shield,
  debt: Landmark,
  portfolio: LineChart,
  fees: BadgePercent,
  interest: AlertTriangle,
  fx: Globe,
  duplicate: Copy,
  price: TrendingUp,
  payday: CalendarDays,
  rule: Tags,
  fxMarkup: ArrowLeftRight,
  taxRefund: Receipt,
  leak: Coffee,
  spike: Flame,
  emergency: LifeBuoy,
  idle: PiggyBank,
};
/** Suggestions that only inform: confirming just clears them. */
const INFO: Suggestion["type"][] = [
  "fees",
  "interest",
  "fx",
  "duplicate",
  "price",
  "fxMarkup",
  "taxRefund",
  "leak",
  "spike",
  "emergency",
  "idle",
];

/** What the rules noticed in your transactions, each one click to add or dismiss. Hidden when there is nothing. */
/** With `href`, shows at most `limit` and links to the full list instead of expanding. */
/** With `bare`, renders only the list, for a host card that supplies its own frame. */
export function SuggestionsCard({
  limit = 6,
  empty = null,
  href,
  bare,
}: { limit?: number; empty?: React.ReactNode; href?: string; bare?: boolean } = {}) {
  const t = useTranslations("suggestions");
  const tCat = useTranslations("categoriesSeeded");
  const locale = useLocale();
  const gentle = useGentle();
  const g = (key: string) => gentleKey(key, gentle, t.has);
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
      if (s.type === "policy")
        await savePlanItem("policy", {
          name: s.name,
          kind: s.policyKind,
          provider: null,
          monthlyPremium: Math.round(s.monthly),
        });
      if (s.type === "payday" && plan.data)
        await savePlan({ ...plan.data.plan, monthStartDay: s.day });
      if (s.type === "rule")
        await createRule({
          field: "merchant",
          op: "equals",
          value: s.merchant,
          categoryId: s.categoryId,
        });
      await dismissSuggestion(s.key);
    },
    onSuccess: (_, s) => {
      ["suggestions", "plan", "overview"].forEach(
        (k) => void queryClient.invalidateQueries({ queryKey: [k] }),
      );
      if (!INFO.includes(s.type)) toast.success(t("added"));
    },
    onError: () => toast.error(t("failed")),
  });

  const items = query.data?.suggestions ?? [];
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? items.length : limit;
  if (items.length === 0) return <>{empty}</>;

  function onAccept(s: Suggestion) {
    if (s.type === "debt")
      setDialog({
        key: s.key,
        preset: { name: s.name, type: s.debtType, monthlyPayment: Math.round(s.monthly) },
      });
    else if (s.type === "portfolio")
      setDialog({
        key: s.key,
        preset: {
          name: s.name,
          type: "stock",
          symbol: null,
          monthlyDeposit: Math.round(s.monthly),
        },
      });
    else accept.mutate(s);
  }

  const text = (s: Suggestion) => {
    switch (s.type) {
      case "policy":
        return t(g("policy"), {
          name: s.name,
          amount: shekels(s.monthly, locale),
          kind: t(`kind_${s.policyKind}`),
        });
      case "debt":
        return t(g("debt"), { name: s.name, amount: shekels(s.monthly, locale) });
      case "portfolio":
        return t(g("portfolio"), { name: s.name, amount: shekels(s.monthly, locale) });
      case "fees":
        return t(g("fees"), { amount: shekels(s.yearly, locale), count: s.count });
      case "interest":
        return t(g("interest"), { amount: shekels(s.yearly, locale) });
      case "fx":
        return t(g("fx"), { amount: shekels(s.yearly, locale) });
      case "duplicate":
        return t(g("duplicate"), {
          name: s.name,
          amount: shekels(s.amount, locale),
          date: new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(
            new Date(`${s.date}T12:00:00`),
          ),
        });
      case "price":
        return t(g("price"), {
          name: s.name,
          from: shekels(s.from, locale),
          to: shekels(s.to, locale),
        });
      case "payday":
        return t(g("payday"), { day: s.day });
      case "taxRefund":
        return t(g(s.reason === "twoEmployers" ? "taxRefundEmployers" : "taxRefundGap"), {
          year: s.year,
          months: s.months,
        });
      case "rule":
        return t(g("rule"), {
          name: s.merchant,
          category: translateCategoryName(s.categoryName, tCat),
          count: s.count,
        });
      case "leak":
        return t(g("leak"), {
          name: s.name,
          count: s.count,
          amount: shekels(s.monthly, locale),
          yearly: shekels(s.monthly * 12, locale),
        });
      case "spike":
        return t(g("spike"), {
          category: translateCategoryName(s.category, tCat),
          pct: s.pct,
          amount: shekels(s.current, locale),
          avg: shekels(s.avg, locale),
        });
      case "emergency":
        return t(g("emergency"), {
          months: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(s.months),
          target: shekels(s.target, locale),
        });
      case "idle":
        return t(g("idle"), { amount: shekels(s.amount, locale) });
      case "fxMarkup":
        return t(g("fxMarkup"), {
          amount: shekels(s.total, locale),
          pct: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(s.avgPct),
          count: s.count,
        });
    }
  };

  const body = (
    <>
      <ul className="divide-y divide-border">
        {items.slice(0, shown).map((s) => {
          const Icon = ICONS[s.type];
          return (
            <li key={s.key} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <span
                className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"
                aria-hidden
              >
                <Icon className="size-4" />
              </span>
              <p className="min-w-0 flex-1 text-footnote text-pretty">{text(s)}</p>
              <div className="flex shrink-0 gap-1">
                <IconButton
                  label={INFO.includes(s.type) ? t("gotIt") : t("add")}
                  variant={INFO.includes(s.type) ? "ghost" : "default"}
                  size="icon-sm"
                  disabled={accept.isPending}
                  onClick={() => onAccept(s)}
                >
                  <Check className="size-4" aria-hidden />
                </IconButton>
                {!INFO.includes(s.type) && (
                  <IconButton
                    label={t("dismiss")}
                    size="icon-sm"
                    onClick={() => dismiss.mutate(s.key)}
                  >
                    <X className="size-4" aria-hidden />
                  </IconButton>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {items.length > limit && href && (
        <Link
          href={href}
          className="mt-3 inline-block rounded-full px-3 py-1.5 text-footnote font-medium text-primary hover:bg-accent"
        >
          {t("more", { count: items.length - limit })}
        </Link>
      )}
      {items.length > limit && !href && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          aria-expanded={showAll}
          className="mt-3 rounded-full px-3 py-1.5 text-footnote font-medium text-primary hover:bg-accent"
        >
          {showAll ? t("showLess") : t("more", { count: items.length - limit })}
        </button>
      )}
      {dialog && (
        <AssetDialog
          asset="new"
          preset={dialog.preset}
          onClose={() => setDialog(null)}
          onSaved={() => dismiss.mutate(dialog.key)}
        />
      )}
    </>
  );
  if (bare) return body;
  return (
    <CardShell
      label={t("title")}
      action={<NotifyToggle />}
      className="mb-6 h-auto scroll-mt-20 md:mb-8"
      id="suggestions"
    >
      {body}
    </CardShell>
  );
}

/** Turns on desktop notifications for new findings; the browser asks once. */
export function NotifyToggle() {
  const t = useTranslations("suggestions");
  const [permission, setPermission] = useState(() =>
    typeof Notification === "undefined" ? "denied" : Notification.permission,
  );
  if (typeof Notification === "undefined" || permission === "denied") return null;
  const on = permission === "granted";
  return (
    <IconButton
      label={on ? t("notifyOn") : t("notifyEnable")}
      size="icon-sm"
      disabled={on}
      onClick={async () => setPermission(await Notification.requestPermission())}
    >
      {on ? <BellRing className="size-4" aria-hidden /> : <Bell className="size-4" aria-hidden />}
    </IconButton>
  );
}
