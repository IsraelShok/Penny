"use client";
import { TransactionsHero } from "@/components/ui/page-hero";
import { TransactionViews } from "./transaction-views";
import { UpcomingCharges } from "./upcoming-charges";

import { DataState } from "@/components/ui/data-state";
import { Segmented } from "@/components/ui/segmented";

import {useSearchParams} from "next/navigation";
import { useEffect, useState } from "react";
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
import { Plus, X , EyeOff } from "lucide-react";
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

/** ?add=1 opens the add form once (from a link or shortcut); dropped on close so a reload doesn't reopen it. */
function dropAddParam() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("add")) return;
  url.searchParams.delete("add");
  window.history.replaceState(window.history.state, "", url);
}

export function TransactionsPage() {
  const params=useSearchParams();
  const t = useTranslations("transactions");
  const tReview = useTranslations("review");
  // ?review=1 is how the budget screen sends people to the transactions that still need a category.
  const [view, setView] = useState<"review" | "all" | "settle">(() => (params.get("review") === "1" ? "review" : "all"));
  const tSettle = useTranslations("settle");
  const tKids = useTranslations("kids");
  const tOwner = useTranslations("ownerFilter");
  const tHidden = useTranslations("hiddenRows");
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
  const [tagFilter, setTagFilter] = useState<string | null>(() => params.get("tag"));
  // "filter by member": whose rows to show (a member id or "shared"); empty is everyone.
  const [ownerFilter, setOwnerFilter] = useState<string>(() => params.get("owner") ?? "");
  // Trash: rows hidden from totals, each restorable from its row menu.
  const [hiddenOnly, setHiddenOnly] = useState(() => params.get("hidden") === "1");
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
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("month", from.slice(0, 7));
    if (search) url.searchParams.set("search", search); else url.searchParams.delete("search");
    if (categoryFilter.length === 1) url.searchParams.set("category", String(categoryFilter[0]));
    else url.searchParams.delete("category");
    if (view === "review") url.searchParams.set("review", "1"); else url.searchParams.delete("review");
    if (tagFilter) url.searchParams.set("tag", tagFilter); else url.searchParams.delete("tag");
    if (ownerFilter) url.searchParams.set("owner", ownerFilter); else url.searchParams.delete("owner");
    if (hiddenOnly) url.searchParams.set("hidden", "1"); else url.searchParams.delete("hidden");
    window.history.replaceState(null, "", url);
  }, [from, search, categoryFilter, view, tagFilter, ownerFilter, hiddenOnly]);

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
      ownerFilter,
      hiddenOnly,
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
        owner: ownerFilter || undefined,
        hidden: hiddenOnly ? "1" : undefined,
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

      <TransactionSheet open={sheet !== null} onOpenChange={(o) => { if (!o) { setSheet(null); dropAddParam(); } }} txn={sheet === "new" ? null : sheet} members={members} />
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
        {members.length >= 2 && (
          <label className="flex w-fit items-center gap-2 text-sm">{tOwner("filter")}
            <select value={ownerFilter} onChange={(e) => { setOwnerFilter(e.target.value); setPage(0); }} className="h-9 rounded-lg border border-border/60 bg-background px-2 text-sm focus-visible:outline-2 focus-visible:outline-ring">
              <option value="">{tOwner("everyone")}</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              <option value="shared">{tOwner("shared")}</option>
            </select>
          </label>
        )}
        {members.some((m) => m.role === "child") && (
          <label className="flex w-fit items-center gap-2 text-sm">{tKids("filter")}
            <select value={kidFilter} onChange={(e) => setKidFilter(e.target.value)} className="h-9 rounded-lg border border-border/60 bg-background px-2 text-sm focus-visible:outline-2 focus-visible:outline-ring">
              <option value="">{tKids("all")}</option>
              {members.filter((m) => m.role === "child").map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
        )}
        {kidFilter ? <KidSummary member={kidFilter} month={from.slice(0, 7)} /> : <>
        {from === getMonthRange(new Date()).from && <UpcomingCharges />}
        <button type="button" aria-pressed={hiddenOnly} onClick={() => { setHiddenOnly(!hiddenOnly); setPage(0); }}
          className={`inline-flex min-h-9 w-fit items-center gap-1.5 rounded-full border px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring ${hiddenOnly ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
          <EyeOff className="size-4" aria-hidden />{tHidden("toggle")}
        </button>
        {hiddenOnly && <p className="text-sm text-muted-foreground">{tHidden("hint")}</p>}
        <TransactionViews
          current={{ search, categoryIds: categoryFilter, tag: tagFilter, kind, review: false }}
          onApply={(f) => { setSearch(f.search); setCategoryFilter(f.categoryIds); setTagFilter(f.tag); setKind(f.kind); if (f.review) setView("review"); setPage(0); }}
        />
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
