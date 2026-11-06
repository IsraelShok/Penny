"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { getHome, getInsights, getSettings } from "@/lib/api";
import { PageHeader } from "@/components/layout/app-shell";
import { AINotConnectedBanner } from "@/components/ai-not-connected-banner";
import { ThisMonthCard } from "./this-month-card";
import { CashFlowCard } from "./cash-flow-card";
import { Greeting } from "./greeting";
import { MarketStrip } from "@/components/markets/markets-view";
import { SuggestionsCard } from "./suggestions-card";
import { NextBillCard, SubscriptionsCard } from "./bills-card";
import { TodayCard } from "./today-card";
import { MoreSection } from "./more-section";
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

const ROW_1 = "col-span-12 lg:col-span-8";
const ROW_1_SIDE = "col-span-12 sm:col-span-6 lg:col-span-4";
const ROW_2 = "col-span-12 md:col-span-6 lg:col-span-7";
const ROW_2_SIDE = "col-span-12 md:col-span-6 lg:col-span-5";
const FULL = "col-span-12";

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
        <WelcomePrompt />
        <MoreSection>
        <SuggestionsCard limit={1} />
        <HomeTeasers />
        {/* A setup nudge, not today's business: it waits under "more". */}
        <AINotConnectedBanner className="mb-4 md:mb-5 lg:mb-6" />
        <MarketStrip />
        <div className="grid grid-cols-12 gap-3 md:gap-4">
          {renderSection("thisMonth", data, isLoading, isError, ROW_1, skeletonLabels)}
          <div className="col-span-12 grid gap-3 sm:grid-cols-2 md:gap-4 lg:col-span-4 lg:grid-cols-1">
            {insights ? (
              <>
                <NextBillCard data={insights} />
                <SubscriptionsCard data={insights} />
              </>
            ) : (
              <>
                <CardSkeleton label={t("nextBill")} height={48} />
                <CardSkeleton label={t("subscriptionsTitle")} height={48} />
              </>
            )}
          </div>
          {renderSection("needsAttention", data, isLoading, isError, ROW_1_SIDE, skeletonLabels)}
          {renderSection("cashFlow", data, isLoading, isError, ROW_1_SIDE, skeletonLabels)}
          {renderSection("historicalTrend", data, isLoading, isError, ROW_1_SIDE, skeletonLabels)}
          {renderSection("categories", data, isLoading, isError, `${FULL} mt-4 md:mt-6`, skeletonLabels)}
          {renderSection("recentTransactions", data, isLoading, isError, ROW_2, skeletonLabels)}
          {renderSection("topMerchants", data, isLoading, isError, ROW_2_SIDE, skeletonLabels)}
          {renderSection("bankHealth", data, isLoading, isError, FULL, skeletonLabels)}
        </div>
        </MoreSection>
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
