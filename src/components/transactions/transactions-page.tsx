"use client";
import { TransactionsHero } from "@/components/ui/page-hero";

import { DataState } from "@/components/ui/data-state";
import { Segmented } from "@/components/ui/segmented";

import {useSearchParams} from "next/navigation";
import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/app-shell";
import { TransactionsTable } from "@/components/dashboard/transactions-table";
import { monthKey } from "@/components/ui/month-nav";
import { AINotConnectedBanner } from "@/components/ai-not-connected-banner";
import { WidgetsRow } from "./widgets-row";
import { ReviewInbox } from "./review-inbox";
import { CashWalletCard } from "./cash-wallet-card";
import { OwnerSummary } from "./owner-summary";
import { SettleLedger } from "./settle-ledger";
import { KidSummary } from "./kid-summary";
import { useHousehold } from "@/hooks/use-household";
import { Plus, X } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { Button } from "@/components/ui/button";
import { TransactionSheet } from "./transaction-sheet";
import type { TransactionWithCategory } from "@/lib/types";
import { getOwners, getTagReport } from "@/lib/api";
import {
  getCategories,
  getTransactions,
  getTransactionsSummary,
  listIntegrations,
} from "@/lib/api";
import type { TransactionKindFilter } from "@/lib/api";
import { expandCategoryFilterIds } from "@/lib/transaction-filters";
import {
  nextSortState,
  type SortOrder,
  type TransactionSortField,
} from "@/lib/transaction-sort";
import {
  formatMonthLabel,
  getMonthRange,
} from "@/lib/formatters";
import type { Locale } from "@/i18n/routing";

export function TransactionsPage() {
  const params=useSearchParams();
  const t = useTranslations("transactions");
  const tReview = useTranslations("review");
  const [view, setView] = useState<"review" | "all" | "settle">("all");
  const tSettle = useTranslations("settle");
  const tKids = useTranslations("kids");
  const [kidFilter, setKidFilter] = useState<string>("");
  const locale = useLocale() as Locale;
  const [selectedDate, setSelectedDate] = useState(()=>{const month=params.get("month");return month&&/^\d{4}-(0[1-9]|1[0-2])$/.test(month)?new Date(month+"-01T12:00:00"):new Date(new Date().getFullYear(),new Date().getMonth(),1);});
  const [search, setSearch] = useState(params.get("search")??"");
  const [categoryFilter, setCategoryFilter] = useState<number[]>(()=>{const id=Number(params.get("category"));return params.has("category")&&Number.isInteger(id)&&id>=0?[id]:[];});
  const [accountFilter, setAccountFilter] = useState<number[]>([]);
  const [page, setPage] = useState(0);
  const [kind, setKind] = useState<TransactionKindFilter>("all");
  const [sortField, setSortField] = useState<TransactionSortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const tTags = useTranslations("tags");
  const { household } = useHousehold();
  const members = household.members;
  const tManual = useTranslations("manualTxn");
  // null = closed, "new" = add sheet, a row = edit sheet. ?add=1 (home quick-add) opens the add sheet.
  const [sheet, setSheet] = useState<TransactionWithCategory | "new" | null>(() => (params.get("add") === "1" ? "new" : null));

  const filterOptions: { value: TransactionKindFilter; label: string }[] = [
    { value: "all", label: t("filterAll") },
    { value: "income", label: t("filterIncome") },
    { value: "expense", label: t("filterExpenses") },
  ];

  const { from, to } = getMonthRange(selectedDate);

  const allCategoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => getCategories(),
  });
  const integrationsQuery = useQuery({
    queryKey: ["integrations"],
    queryFn: () => listIntegrations(),
  });

  const expandedCategoryIds = expandCategoryFilterIds(
    categoryFilter,
    allCategoriesQuery.data ?? []
  );

  const transactionsQuery = useQuery({
    queryKey: [
      "transactions",
      from,
      to,
      search,
      categoryFilter,
      accountFilter,
      page,
      kind,
      sortField,
      sortOrder,
      tagFilter,
    ],
    queryFn: () =>
      getTransactions({
        // `tag` is passed through as a query param by getTransactions.
        ...({ tag: tagFilter ?? undefined } as object),
        from,
        to,
        search: search || undefined,
        categoryIds: expandedCategoryIds,
        credentialIds:
          accountFilter.length > 0 ? accountFilter : undefined,
        limit: 50,
        offset: page * 50,
        kind,
        sort: sortField,
        order: sortOrder,
      }),
    placeholderData: keepPreviousData,
  });

  const summaryQuery = useQuery({
    queryKey: ["transactions-summary", from, to],
    queryFn: () => getTransactionsSummary({ from, to }),
  });

  const categoriesQuery = useQuery({
    queryKey: ["categories", kind === "income" ? "income" : "expense"],
    queryFn: () =>
      kind === "income" ? getCategories("income") : getCategories("expense"),
  });

  const tagsQuery = useQuery({ queryKey: ["tags"], queryFn: () => getTagReport() });
  const ownersQuery = useQuery({
    queryKey: ["owners", from, to],
    queryFn: () => getOwners(from, to),
    enabled: members.length >= 2,
  });

  const monthLabel = formatMonthLabel(selectedDate, locale);
  const noData = transactionsQuery.data?.total === 0 && !search && !categoryFilter.length && !accountFilter.length && !tagFilter && kind === "all";
  // The table carries the desktop "+" button; keep one in the header when it is not shown.
  const headerAdd = view !== "all" || !!kidFilter || noData;

  const summaryInitialLoading =
    summaryQuery.isPending && summaryQuery.data === undefined;
  const tableInitialLoading =
    transactionsQuery.isPending && transactionsQuery.data === undefined;

  return (
    <>
      <PageHeader
        title={t("pageTitle")}
        largeTitle={false}
        actions={
          <div className="flex items-center gap-2">
            {headerAdd && (
              <IconButton label={tManual("addTitle")} variant="outline" className="hidden md:inline-flex" onClick={() => setSheet("new")}>
                <Plus className="size-4" aria-hidden />
              </IconButton>
            )}
          </div>
        }
      />

      <TransactionSheet open={sheet !== null} onOpenChange={(o) => !o && setSheet(null)} txn={sheet === "new" ? null : sheet} members={members} />
      {/* Mobile add button floats above the dock (dock is ~76px + safe area). */}
      <Button aria-label={tManual("addTitle")} onClick={() => setSheet("new")}
        className="fixed bottom-[calc(88px+env(safe-area-inset-bottom))] end-4 z-40 h-14 rounded-full px-5 shadow-lg md:hidden">
        <Plus className="size-5" aria-hidden />{tManual("add")}
      </Button>
      <div className="space-y-6 px-4 pb-24 pt-3 md:px-6 md:pb-8 lg:px-8">
        <TransactionsHero summary={summaryQuery.data} loading={summaryInitialLoading} error={summaryQuery.isError} onRetry={() => void summaryQuery.refetch()} meta={monthLabel}
          month={{ value: monthKey(selectedDate), onChange: (m) => setSelectedDate(new Date(`${m}-01T12:00:00`)) }} />
        <CashWalletCard />
        <Segmented
          label={tReview("viewLabel")}
          value={view}
          options={[
            { value: "all", label: tReview("tabAll") },
            { value: "review", label: tReview("tab") },
            { value: "settle", label: tSettle("tab") },
          ]}
          onChange={setView}
        />
        {view === "review" ? <ReviewInbox /> : view === "settle" ? <SettleLedger /> :
        summaryQuery.isError || transactionsQuery.isError || integrationsQuery.isError ? <DataState error onRetry={() => { void summaryQuery.refetch(); void transactionsQuery.refetch(); void integrationsQuery.refetch(); }} />
        : summaryInitialLoading || tableInitialLoading || integrationsQuery.isPending ? <DataState loading />
        : noData ? <DataState period={integrationsQuery.data?.some((bank) => bank.lastSyncAt)} />
        : <>
        {members.length >= 2 && <OwnerSummary members={members} from={from} to={to} />}
        {members.some((m) => m.role === "child") && (
          <label className="flex w-fit items-center gap-2 text-sm">{tKids("filter")}
            <select value={kidFilter} onChange={(e) => setKidFilter(e.target.value)} className="h-9 rounded-lg border border-border/60 bg-background px-2 text-sm focus-visible:outline-2 focus-visible:outline-ring">
              <option value="">{tKids("all")}</option>
              {members.filter((m) => m.role === "child").map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
        )}
        {kidFilter ? <KidSummary member={kidFilter} month={from.slice(0, 7)} /> : <>
        {tagFilter && (
          <button
            type="button"
            onClick={() => { setTagFilter(null); setPage(0); }}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm focus-visible:outline-2 focus-visible:outline-ring"
            aria-label={tTags("clearFilter", { tag: tagFilter })}
          >
            #{tagFilter} <X className="size-3.5" aria-hidden />
          </button>
        )}

        <TransactionsTable
          kindFilter={
            <Segmented
              variant="track"
              className="max-sm:w-full"
              label={t("filterLabel")}
              value={kind}
              options={filterOptions}
              onChange={(v) => {
                setKind(v);
                setPage(0);
                setCategoryFilter([]);
              }}
            />
          }
          allTags={(tagsQuery.data?.tags ?? []).map((x) => x.tag)}
          onTagClick={(tag) => { setTagFilter(tag); setPage(0); }}
          members={members}
          onEdit={setSheet}
          onAdd={() => setSheet("new")}
          accountOwners={ownersQuery.data?.accountOwners}
          transactions={transactionsQuery.data?.transactions ?? []}
          total={transactionsQuery.data?.total ?? 0}
          categories={categoriesQuery.data ?? []}
          integrations={integrationsQuery.data ?? []}
          loading={tableInitialLoading}
          isFetching={transactionsQuery.isFetching}
          sortField={sortField}
          sortOrder={sortOrder}
          onSortChange={(field) => {
            const next = nextSortState(sortField, sortOrder, field);
            setSortField(next.field);
            setSortOrder(next.order);
            setPage(0);
          }}
          search={search}
          onSearchChange={setSearch}
          categoryFilter={categoryFilter}
          onCategoryFilterChange={(ids) => {
            setCategoryFilter(ids);
            setPage(0);
          }}
          accountFilter={accountFilter}
          onAccountFilterChange={(ids) => {
            setAccountFilter(ids);
            setPage(0);
          }}
          page={page}
          onPageChange={setPage}
        />
        </>}
        <WidgetsRow summary={summaryQuery.data} loading={summaryInitialLoading} />
        <AINotConnectedBanner />
        </>}
      </div>
    </>
  );
}
