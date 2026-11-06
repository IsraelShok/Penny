"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { DataState } from "@/components/ui/data-state";
import { getSummary, getTransactions, listIntegrations, getBudgetMoves } from "@/lib/api";
import { applyMoves } from "@/lib/budget-moves";
import { IncomeSmoothingCard } from "./income-smoothing-card";
import { getMonthRange, formatMonthLabel, addMonths } from "@/lib/formatters";
import { PageHeader } from "@/components/layout/app-shell";
import { HeroCard } from "./hero-card";
import { CategoryGrid } from "./category-grid";
import { PeriodSelector } from "./period-selector";
import { SyncButton } from "./sync-button";
import { CategorizeButton } from "./categorize-button";
import { BudgetFromAverage } from "./budget-from-average";
import { PeriodicCard } from "./periodic-card";
import { AINotConnectedBanner } from "@/components/ai-not-connected-banner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CategoryViewMode } from "@/lib/types";
import type { Locale } from "@/i18n/routing";

const VIEW_MODE_KEY = "spent.dashboard.viewMode";

function readViewMode(): CategoryViewMode {
  if (typeof window === "undefined") return "collapsed";
  try {
    const raw = window.localStorage.getItem(VIEW_MODE_KEY);
    return raw === "expanded" ? "expanded" : "collapsed";
  } catch {
    return "collapsed";
  }
}

export function Dashboard() {
  const t = useTranslations("dashboard");
  const locale = useLocale() as Locale;
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<CategoryViewMode>("collapsed");
  const queryClient = useQueryClient();

  useEffect(() => {
    setViewMode(readViewMode());
  }, []);

  const handleViewModeChange = useCallback((mode: CategoryViewMode) => {
    setViewMode(mode);
    try {
      window.localStorage.setItem(VIEW_MODE_KEY, mode);
    } catch {
      // Storage may be unavailable; in-memory state still works.
    }
  }, []);

  const { from, to } = getMonthRange(selectedDate);

  const summaryQuery = useQuery({
    queryKey: ["summary", from, to],
    queryFn: () => getSummary({ from, to }),
  });

  const handleSyncComplete = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["summary"] });
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["settings"] });
    queryClient.invalidateQueries({ queryKey: ["budget-period"] });
    queryClient.invalidateQueries({ queryKey: ["integrations"] });
  }, [queryClient]);

  const monthLabel = formatMonthLabel(selectedDate, locale);
  const month = from.slice(0, 7);
  const moves = useQuery({ queryKey: ["budget-moves", month], queryFn: () => getBudgetMoves(month) });
  // Effective budgets for this month: base budget ± "move from X" moves.
  const summary = useMemo(() => {
    const s = summaryQuery.data;
    if (!s || !moves.data?.length) return s;
    return { ...s, categoriesWithData: applyMoves(s.categoriesWithData, moves.data, s.timeElapsedPercent) };
  }, [summaryQuery.data, moves.data]);
  const period = useQuery({ queryKey: ["budget-period", from, to], queryFn: () => getTransactions({ from, to, limit: 1 }) });
  const banks = useQuery({ queryKey: ["integrations"], queryFn: listIntegrations });

  return (
    <>
      <PageHeader
        title={t("pageTitle")}
        meta={monthLabel}
        actions={
          <>
            <PeriodSelector
              label={monthLabel}
              onPrev={() => setSelectedDate((d) => addMonths(d, -1))}
              onNext={() => setSelectedDate((d) => addMonths(d, 1))}
            />
            <CategorizeButton onApplied={handleSyncComplete} />
            <SyncButton onComplete={handleSyncComplete} />
          </>
        }
      />

      <div className="space-y-6 px-4 pb-8 pt-3 md:px-6 lg:px-8">
        {summaryQuery.isError || period.isError || banks.isError ? <DataState error onRetry={() => { void summaryQuery.refetch(); void period.refetch(); void banks.refetch(); }} />
        : summaryQuery.isPending || period.isPending || banks.isPending ? <DataState loading />
        : period.data?.total === 0 ? <DataState period={banks.data?.some((bank) => bank.lastSyncAt)} />
        : <>
        <HeroCard
          data={summary}
          loading={summaryQuery.isLoading}
          monthLabel={monthLabel}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <BudgetFromAverage modes={new Map((summary?.categoriesWithData ?? []).map((c) => [c.categoryId, c.budgetMode]))} />
          <Tabs
            value={viewMode}
            onValueChange={(v) =>
              handleViewModeChange(v === "expanded" ? "expanded" : "collapsed")
            }
          >
            <TabsList>
              <TabsTrigger value="collapsed">{t("viewModeGrouped")}</TabsTrigger>
              <TabsTrigger value="expanded">{t("viewModeAll")}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <CategoryGrid
          categories={summary?.categoriesWithData ?? []}
          loading={summaryQuery.isLoading}
          periodTotal={summary?.periodTotal ?? 0}
          from={from}
          to={to}
          viewMode={viewMode}
          month={month}
          moves={moves.data ?? []}
        />
        {from === getMonthRange(new Date()).from && <IncomeSmoothingCard />}
        <PeriodicCard />
        <AINotConnectedBanner />
        </>}
      </div>
    </>
  );
}
