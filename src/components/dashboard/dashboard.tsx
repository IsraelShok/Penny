"use client";

import { useState, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { DataState } from "@/components/ui/data-state";
import { getSummary, getTransactions, listIntegrations } from "@/lib/api";
import { getMonthRange, formatMonthLabel, addMonths } from "@/lib/formatters";
import { PageHeader } from "@/components/layout/app-shell";
import { HeroCard } from "./hero-card";
import { CategoryGrid } from "./category-grid";
import { PeriodSelector } from "./period-selector";
import { SyncButton } from "./sync-button";
import { CategorizeButton } from "./categorize-button";
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
  const summary = summaryQuery.data;
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

      <div className="space-y-6 p-4 md:p-6 lg:p-8">
        {summaryQuery.isError || period.isError || banks.isError ? <DataState error onRetry={() => { void summaryQuery.refetch(); void period.refetch(); void banks.refetch(); }} />
        : summaryQuery.isPending || period.isPending || banks.isPending ? <DataState loading />
        : period.data?.total === 0 ? <DataState period={banks.data?.some((bank) => bank.lastSyncAt)} />
        : <>
        <HeroCard
          data={summary}
          loading={summaryQuery.isLoading}
          monthLabel={monthLabel}
        />

        <div className="flex items-center justify-end">
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
        />
        <AINotConnectedBanner />
        </>}
      </div>
    </>
  );
}
