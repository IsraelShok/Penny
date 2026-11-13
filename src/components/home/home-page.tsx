"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { getHome, getInsights, getSettings } from "@/lib/api";
import { PageHeader } from "@/components/layout/app-shell";
import { ThisMonthCard } from "./this-month-card";
import { CashFlowCard } from "./cash-flow-card";
import { Greeting } from "./greeting";
import { SuggestionsCard } from "./suggestions-card";
import { NextBillCard, SubscriptionsCard } from "./bills-card";
import { TodayCard } from "./today-card";
import { HealthCard } from "./health-card";
import { MoreSection } from "./more-section";
import { PersonalGrid } from "./personal-grid";
import { ScenarioCard } from "./scenario-card";
import { GoalFocus } from "./goal-focus";
import { HomeTeasers, WelcomePrompt } from "./home-teasers";
import { CategoryScroll } from "./category-scroll";
import { HistoricalTrendCard } from "./historical-trend-card";
import { RecentTransactionsCard } from "./recent-transactions-card";
import { TopMerchantsCard } from "./top-merchants-card";
import { NeedsAttentionCard } from "./needs-attention-card";
import { BankHealthCard } from "./bank-health-card";
import { SyncFailureBanner } from "./sync-failure-banner";
import { CardError, CardSkeleton } from "./card-shell";
import type { HomePayload, HomeSection } from "@/lib/types";

export function HomePage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [autoStartSync] = useState(() => searchParams.get("sync") === "1");
  const t = useTranslations("home");
  const skeletonLabels = useMemo<Record<HomeSection, string>>(
    () => ({
      thisMonth: t("thisMonthLabel", { month: "" }).trim() || t("topCategoriesTitle"),
      cashFlow: t("cashFlowTitle"),
      categorySnapshot: t("topCategoriesTitle"),
      historicalTrend: t("last8Months"),
      recentTransactions: t("recentActivity"),
      topMerchants: t("topMerchants"),
      needsAttention: t("needsAttention"),
      bankHealth: t("bankConnections"),
      categories: t("categoriesTitle"),
    }),
    [t]
  );

  useEffect(() => {
    if (autoStartSync) {
      router.replace("/", { scroll: false });
    }
  }, [autoStartSync, router]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["home"],
    queryFn: getHome,
  });

  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const { data: insights } = useQuery({ queryKey: ["insights"], queryFn: getInsights });

  return (
    <>
      <PageHeader
        title={t("pageTitle")}
        largeTitle={false}
      />

      <div className="mx-auto w-full max-w-6xl px-4 pb-8 pt-3 md:px-6 lg:px-8">
        <SyncFailureBanner
          items={data?.bankHealth ?? null}
          className="mb-4 md:mb-5 lg:mb-6"
        />
        <Greeting name={settings?.displayName} />
        <TodayCard home={data} bills={insights?.forecast} homePending={isLoading} homeFailed={isError} onRetry={() => { void queryClient.invalidateQueries({ queryKey: ["home"] }); }} />
        <HealthCard />
        <WelcomePrompt />
        <PersonalGrid render={id => {
          if (id === "goals") return <GoalFocus />;
          if (id === "planner") return <ScenarioCard />;
          if (id === "bills") return insights ? <div className="space-y-3"><NextBillCard data={insights} /><SubscriptionsCard data={insights} /></div> : <CardSkeleton label={t("nextBill")} />;
          return renderSection(id, data, isLoading, isError, "", skeletonLabels);
        }} />
        <MoreSection><SuggestionsCard limit={1} /></MoreSection>
      </div>
    </>
  );
}

function renderSection(
  section: HomeSection,
  data: HomePayload | undefined,
  isLoading: boolean,
  isError: boolean,
  spanClass: string,
  skeletonLabels: Record<HomeSection, string>
) {
  if (isError) {
    return <div key={section} className={spanClass}><CardError label={skeletonLabels[section]} /></div>;
  }

  if (isLoading || !data) {
    return (
      <div key={section} className={spanClass}>
        <CardSkeleton label={skeletonLabels[section]} height={SKELETON_HEIGHTS[section]} />
      </div>
    );
  }

  const sectionHasError =
    isError || data.errors.some((e) => e.section === section);

  if (sectionHasError) {
    return (
      <div key={section} className={spanClass}>
        <CardError label={skeletonLabels[section]} />
      </div>
    );
  }

  return (
    <div key={section} className={spanClass}>
      {renderCard(section, data)}
    </div>
  );
}

function renderCard(section: HomeSection, data: HomePayload) {
  switch (section) {
    case "thisMonth":
      return data.thisMonth ? <ThisMonthCard data={data.thisMonth} /> : null;
    case "cashFlow":
      return data.cashFlow ? <CashFlowCard data={data.cashFlow} /> : null;
    case "categorySnapshot":
      // Superseded on Home by the category scroll.
      return null;
    case "categories":
      return data.categories ? <CategoryScroll items={data.categories} /> : null;
    case "historicalTrend":
      return data.historicalTrend ? (
        <HistoricalTrendCard data={data.historicalTrend} />
      ) : null;
    case "recentTransactions":
      return data.recentTransactions ? (
        <RecentTransactionsCard items={data.recentTransactions} />
      ) : null;
    case "topMerchants":
      return data.topMerchants ? (
        <TopMerchantsCard items={data.topMerchants} />
      ) : null;
    case "needsAttention":
      return data.needsAttention ? (
        <NeedsAttentionCard data={data.needsAttention} />
      ) : null;
    case "bankHealth":
      return data.bankHealth ? (
        <BankHealthCard items={data.bankHealth} />
      ) : null;
  }
}

const SKELETON_HEIGHTS: Record<HomeSection, number> = {
  thisMonth: 180,
  cashFlow: 160,
  categorySnapshot: 220,
  historicalTrend: 180,
  recentTransactions: 280,
  topMerchants: 220,
  needsAttention: 160,
  bankHealth: 160,
  categories: 480,
};
