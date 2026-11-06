"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatCurrency } from "@/lib/formatters";
import type { TransactionsSummary } from "@/lib/api";
import type { Locale } from "@/i18n/routing";

interface KpiCardsProps {
  summary?: TransactionsSummary;
  loading: boolean;
}

export function KpiCards({ summary, loading }: KpiCardsProps) {
  const t = useTranslations("transactions");
  const locale = useLocale() as Locale;
  const income = summary?.income.total ?? 0;
  const expense = summary?.expense.total ?? 0;
  const net = summary?.net ?? 0;
  const incomeCount = summary?.income.count ?? 0;
  const expenseCount = summary?.expense.count ?? 0;
  const netPositive = net > 0;

  const countMeta = (count: number): string => {
    const label = count === 1 ? t("kpiTransactionOne") : t("kpiTransactionOther");
    return `${count} ${label}`;
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <KpiCard
        label={t("kpiIncome")}
        amount={income}
        meta={countMeta(incomeCount)}
        color="var(--foreground)"
        loading={loading}
        locale={locale}
      />
      <KpiCard
        label={t("kpiExpenses")}
        amount={expense}
        meta={countMeta(expenseCount)}
        color="var(--foreground)"
        loading={loading}
        locale={locale}
      />
      <KpiCard
        label={net >= 0 ? t("kpiNetSaved") : t("kpiNetOverspend")}
        amount={Math.abs(net)}
        meta={net === 0 ? t("kpiBalanced") : netPositive ? t("kpiIncomeExceeded") : t("kpiExpensesExceeded")}
        color={
          net === 0
            ? "var(--muted-foreground)"
            : netPositive
              ? "var(--foreground)"
              : "var(--status-heads-up)"
        }
        loading={loading}
        locale={locale}
      />
    </div>
  );
}

interface KpiCardProps {
  label: string;
  amount: number;
  meta: string;
  color: string;
  loading: boolean;
  locale: Locale;
}

function KpiCard({
  label,
  amount,
  meta,
  color,
  loading,
  locale,
}: KpiCardProps) {
  return (
    <div className="rounded-2xl bg-card p-5">
      <div className="text-sm font-medium text-muted-foreground">
          {label}
        </div>
      <div
        className="mt-2 font-semibold text-3xl tabular-nums"
        style={{ color }}
      >
        {loading ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          formatCurrency(amount, "ILS", locale)
        )}
      </div>
      <div className="mt-1 text-sm text-muted-foreground">{!loading && meta}</div>
    </div>
  );
}
