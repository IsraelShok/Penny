"use client";

import { Forward, Back } from "@/components/ui/dir-chevron";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { SplitEditor } from "@/components/transactions/split-editor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/icon-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MoreHorizontal,
  HelpCircle,
  Check,
  ArrowDownRight,
  ArrowUpRight,
  Wallet,
  Tags,
  EyeOff,
  Eye,
  X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency, formatDate } from "@/lib/formatters";
import {
  editTransactions,
  setTransactionKind,
  approveTransactionCategory,
  getCategories,
  setTransactionExcluded,
  setTransactionOwner,
} from "@/lib/api";
import { toast } from "sonner";
import { translateCategoryName, translateProviderName } from "@/lib/i18n-data";
import {
  getAccountDisplayLabel,
  TransactionSourceCell,
} from "@/components/transactions/transaction-source-cell";
import {
  TransactionMultiFilter,
  MultiFilterOption,
} from "@/components/transactions/transaction-multi-filter";
import {
  formatMultiFilterDisplay,
  getCategoryDescendantIds,
  isCategoryFilterChecked,
  toggleCategoryFilterSelection,
} from "@/lib/transaction-filters";
import { SortableTableHead } from "@/components/transactions/sortable-table-head";
import type { SortOrder, TransactionSortField } from "@/lib/transaction-sort";
import { cn } from "@/lib/utils";
import { ProviderBadge } from "@/components/setup/provider-badge";
import type {
  TransactionWithCategory,
  Category,
  Integration,
} from "@/lib/types";
import { BANK_PROVIDERS } from "@/lib/types";
import type { Locale } from "@/i18n/routing";
import type { HouseholdMember } from "@/lib/household";
import type { AccountOwners } from "@/lib/tags";
import { TagChips } from "@/components/transactions/tag-chips";
import { OwnerPicker } from "@/components/transactions/owner-picker";

type Kind = "expense" | "income" | "transfer";

interface TransactionsTableProps {
  transactions: TransactionWithCategory[];
  total: number;
  categories: Category[];
  integrations: Integration[];
  loading: boolean;
  search: string;
  onSearchChange: (search: string) => void;
  categoryFilter: number[];
  onCategoryFilterChange: (categoryIds: number[]) => void;
  accountFilter: number[];
  onAccountFilterChange: (credentialIds: number[]) => void;
  page: number;
  onPageChange: (page: number) => void;
  sortField: TransactionSortField;
  sortOrder: SortOrder;
  onSortChange: (field: TransactionSortField) => void;
  isFetching?: boolean;
  /** Tags and owners; optional so other callers keep working. */
  allTags?: string[];
  onTagClick?: (tag: string) => void;
  members?: HouseholdMember[];
  accountOwners?: AccountOwners;
}

const PAGE_SIZE = 50;

export function TransactionsTable({
  transactions,
  total,
  categories,
  integrations,
  loading,
  search,
  onSearchChange,
  categoryFilter,
  onCategoryFilterChange,
  accountFilter,
  onAccountFilterChange,
  page,
  onPageChange,
  sortField,
  sortOrder,
  onSortChange,
  isFetching = false,
  allTags = [],
  onTagClick,
  members = [],
  accountOwners = {},
}: TransactionsTableProps) {
  const tTags = useTranslations("tags");
  const t = useTranslations("transactions");
  const tCat = useTranslations("categoriesSeeded");
  const tBanks = useTranslations("banks");
  const locale = useLocale() as Locale;
  const queryClient = useQueryClient();
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [remember, setRemember] = useState(false);
  const [bulkCategory, setBulkCategory] = useState("");
  const [editing, setEditing] = useState(false);
  const [split, setSplit] = useState<TransactionWithCategory | null>(null);
  const [undoToken, setUndoToken] = useState<string | null>(null);
  const he = locale === "he";
  const selectionKey = transactions.map(t => t.id).join(",");
  useEffect(() => { setSelected([]); }, [selectionKey]);
  const selectedRows = transactions.filter(t => selected.includes(t.id));
  const selectedKind = selectedRows[0]?.kind;
  const bulkCategories = categories.filter(c => c.kind === selectedKind && selectedRows.every(r => r.kind === c.kind) && !categories.some(child => child.parentId === c.id));
  async function edit(input: Parameters<typeof editTransactions>[0]) {
    setEditing(true);
    try {
      const result = await editTransactions(input);
      setUndoToken(result.undoToken);
      setSelected([]);
      await queryClient.invalidateQueries();
      toast.success(t("changesSaved"));
    } catch (error) { toast.error(he ? t("saveFailedHe") : error instanceof Error ? error.message : "Could not save"); throw error; }
    finally { setEditing(false); }
  }
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const otherKinds: Record<Kind, Array<{ value: Kind; label: string }>> = {
    expense: [
      { value: "income", label: t("markAsIncome") },
      { value: "transfer", label: t("markAsTransfer") },
    ],
    income: [
      { value: "expense", label: t("markAsExpense") },
      { value: "transfer", label: t("markAsTransfer") },
    ],
    transfer: [
      { value: "expense", label: t("markAsExpense") },
      { value: "income", label: t("markAsIncome") },
    ],
  };

  const handleCategoryChange = async (txnId: number, categoryId: number) => {
    setUpdatingId(txnId);
    try {
      await edit({ ids: [txnId], categoryId, remember });
    } catch { /* edit reports the error */ }
    finally {
      setUpdatingId(null);
    }
  };

  const handleKindChange = async (txnId: number, next: Kind) => {
    setUpdatingId(txnId);
    try {
      await setTransactionKind(txnId, next);
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["summary"] });
      queryClient.invalidateQueries({ queryKey: ["transactions-summary"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleApprove = async (txnId: number) => {
    setUpdatingId(txnId);
    try {
      await approveTransactionCategory(txnId);
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["summary"] });
      queryClient.invalidateQueries({ queryKey: ["transactions-summary"] });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleOwnerChange = async (txnId: number, owner: string | null) => {
    try {
      await setTransactionOwner(txnId, owner);
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["owners"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const invalidateAfterExclude = () => {
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["summary"] });
    queryClient.invalidateQueries({ queryKey: ["transactions-summary"] });
    queryClient.invalidateQueries({ queryKey: ["home"] });
    queryClient.invalidateQueries({ queryKey: ["categories"] });
    queryClient.invalidateQueries({ queryKey: ["excluded-merchants"] });
  };

  const handleExcludeToggle = async (
    txn: TransactionWithCategory,
    alwaysForMerchant = false,
  ) => {
    const nextExcluded = !txn.isExcluded;
    setUpdatingId(txn.id);
    try {
      await setTransactionExcluded(txn.id, nextExcluded, alwaysForMerchant);
      invalidateAfterExclude();
      if (nextExcluded) {
        toast.success(
          alwaysForMerchant
            ? t("excludeMerchantToast", { merchant: txn.description })
            : t("excludeToast"),
        );
      } else {
        toast.success(t("includeToast"));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setUpdatingId(null);
    }
  };

  const incomeCategoriesQuery = useQuery({
    queryKey: ["categories", "income"],
    queryFn: () => getCategories("income"),
  });
  const expenseCategoriesQuery = useQuery({
    queryKey: ["categories", "expense"],
    queryFn: () => getCategories("expense"),
  });

  const categoriesForKind = (rowKind: Kind): Category[] => {
    if (rowKind === "income") return incomeCategoriesQuery.data ?? [];
    if (rowKind === "expense") return expenseCategoriesQuery.data ?? [];
    return [];
  };

  const accountOptions = integrations
    .map((integration) => {
      const info = BANK_PROVIDERS.find((b) => b.id === integration.provider);
      const providerName = translateProviderName(
        integration.provider,
        info?.name ?? integration.provider,
        tBanks
      );
      const { primary } = getAccountDisplayLabel(
        providerName,
        integration.label
      );
      return { integration, info, providerName, primary };
    })
    .sort((a, b) => a.primary.localeCompare(b.primary));

  const showAccountFilter = accountOptions.length > 1;

  const toggleFilterId = (ids: number[], id: number): number[] =>
    ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];

  const accountLabels = accountFilter
    .map(
      (id) =>
        accountOptions.find((o) => o.integration.id === id)?.primary
    )
    .filter((name): name is string => name != null);

  const accountDisplayValue = formatMultiFilterDisplay(
    accountLabels,
    t("filterAny"),
    (count) => t("filterSelectedCount", { count })
  );

  const categoryLabels = categoryFilter
    .map((id) => categories.find((c) => c.id === id))
    .filter((c): c is Category => c != null)
    .map((c) => translateCategoryName(c.name, tCat));

  const categoryDisplayValue = formatMultiFilterDisplay(
    categoryLabels,
    t("filterAny"),
    (count) => t("filterSelectedCount", { count })
  );

  const hasActiveFilters =
    categoryFilter.length > 0 || accountFilter.length > 0;

  const handleClearFilters = () => {
    onCategoryFilterChange([]);
    onAccountFilterChange([]);
    onPageChange(0);
  };

  const allCategoryIds = [
    ...new Set(
      categories.flatMap((c) => getCategoryDescendantIds(c.id, categories))
    ),
  ];
  const allAccountIds = accountOptions.map((o) => o.integration.id);

  const renderCategoryFilterOptions = (
    parentId: number | null,
    depth: number
  ): React.ReactNode[] => {
    const items = categories
      .filter((c) => c.parentId === parentId)
      .sort((a, b) => a.name.localeCompare(b.name));
    const nodes: React.ReactNode[] = [];
    for (const cat of items) {
      const hasChildren = categories.some((c) => c.parentId === cat.id);
      const name = translateCategoryName(cat.name, tCat);
      nodes.push(
        <MultiFilterOption
          key={cat.id}
          selected={isCategoryFilterChecked(
            cat.id,
            categoryFilter,
            categories
          )}
          onToggle={() =>
            onCategoryFilterChange(
              toggleCategoryFilterSelection(
                categoryFilter,
                cat.id,
                categories
              )
            )
          }
          className={depth > 0 ? "ps-2" : undefined}
        >
          <div
            className={cn(
              "flex items-center gap-2",
              hasChildren && "font-semibold"
            )}
            style={{ paddingInlineStart: depth > 0 ? depth * 12 : 0 }}
          >
            <div
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: cat.color }}
            />
            {name}
          </div>
        </MultiFilterOption>
      );
      nodes.push(...renderCategoryFilterOptions(cat.id, depth + 1));
    }
    return nodes;
  };

  return (
    <Card className="rounded-2xl bg-card shadow-none">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="font-semibold text-2xl">
            {t("pageTitle")}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Input
              placeholder={t("search")}
              aria-label={t("search")}
              value={search}
              onChange={(e) => {
                onSearchChange(e.target.value);
                onPageChange(0);
              }}
              className="h-8 w-[200px]"
            />
            {showAccountFilter ? (
              <TransactionMultiFilter
                label={t("filterAccount")}
                icon={Wallet}
                displayValue={accountDisplayValue}
                triggerClassName="w-[200px]"
                selectAllLabel={t("filterSelectAll")}
                clearLabel={t("filterClearSelection")}
                onSelectAll={() => onAccountFilterChange(allAccountIds)}
                onClear={() => onAccountFilterChange([])}
              >
                {accountOptions.map(({ integration, info, primary }) => (
                  <MultiFilterOption
                    key={integration.id}
                    selected={accountFilter.includes(integration.id)}
                    onToggle={() =>
                      onAccountFilterChange(
                        toggleFilterId(accountFilter, integration.id)
                      )
                    }
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      {info ? (
                        <ProviderBadge
                          color={info.color}
                          name={primary}
                          domain={info.domain}
                          size={16}
                          radius={5}
                        />
                      ) : null}
                      <span className="truncate">{primary}</span>
                    </div>
                  </MultiFilterOption>
                ))}
              </TransactionMultiFilter>
            ) : null}
            <TransactionMultiFilter
              label={t("filterCategory")}
              icon={Tags}
              displayValue={categoryDisplayValue}
              selectAllLabel={t("filterSelectAll")}
              clearLabel={t("filterClearSelection")}
              onSelectAll={() => onCategoryFilterChange(allCategoryIds)}
              onClear={() => onCategoryFilterChange([])}
            >
              {renderCategoryFilterOptions(null, 0)}
            </TransactionMultiFilter>
            {hasActiveFilters ? (
              <IconButton
                label={t("filterClear")}
                type="button"
                size="icon-sm"
                className="shrink-0 text-muted-foreground"
                onClick={handleClearFilters}
              >
                <X className="size-4" aria-hidden />
              </IconButton>
            ) : null}
          </div>
        </div>
        {hasActiveFilters || search.trim().length > 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {t("filterScopedToList")}
          </p>
        ) : null}
      </CardHeader>
      <CardContent
        className={cn(
          isFetching &&
            !loading &&
            "opacity-60 transition-opacity duration-200"
        )}
      >
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {search || categoryFilter.length > 0 || accountFilter.length > 0
              ? t("emptyWithFilters")
              : t("emptyNoData")}
          </div>
        ) : (
          <>
            {/* Bulk tools appear only once something is selected (or there is an edit to undo). */}
            {(selected.length > 0 || undoToken) && <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-muted/50 p-3">
              <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />{t("rememberCategoryForFuture")}</label>
              {undoToken && <Button variant="outline" disabled={editing} onClick={() => void edit({ undo: undoToken }).catch(() => {})}>{t("undoLastEdit")}</Button>}
              {selected.length > 0 && <><span className="text-sm">{selected.length} {t("selected")}</span><select aria-label={t("categoryForSelectedTransactions")} className="min-h-11 rounded-lg border bg-background px-2" value={bulkCategory} onChange={e => setBulkCategory(e.target.value)}><option value="">{t("chooseCategory")}</option>{bulkCategories.map(c => <option key={c.id} value={c.id}>{translateCategoryName(c.name, tCat)}</option>)}</select><Button disabled={editing || isFetching || !bulkCategories.some(c => c.id === Number(bulkCategory))} onClick={() => void edit({ ids: selected, categoryId: Number(bulkCategory), remember }).catch(() => {})}>{t("categorizeSelected")}</Button><Button variant="ghost" onClick={() => setSelected([])}>{t("filterClearSelection")}</Button>{!bulkCategories.length && <p className="text-xs">{t("selectOnlyExpensesOr")}</p>}</>}
            </div>}
            {split && <SplitEditor key={split.id} transaction={split} categories={categories} close={() => setSplit(null)} save={parts => edit({ ids: [split.id], splits: parts })} />}
            {/* First and last columns keep a card-edge gutter, so text never sits on the card's edge while the table scrolls. */}
            <Table className="[&_td:first-child]:ps-4 [&_th:first-child]:ps-4 [&_td:last-child]:pe-4 [&_th:last-child]:pe-4">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[44px]"><input className="size-4" type="checkbox" aria-label={t("selectThisPage")} disabled={editing || isFetching} checked={transactions.length > 0 && selected.length === transactions.length} onChange={e => setSelected(e.target.checked ? transactions.map(t => t.id) : [])} /></TableHead>
                  <SortableTableHead
                    label={t("headerDate")}
                    field="date"
                    activeField={sortField}
                    activeOrder={sortOrder}
                    onSort={onSortChange}
                    className="w-[100px]"
                    sortAscLabel={t("sortAsc")}
                    sortDescLabel={t("sortDesc")}
                  />
                  <SortableTableHead
                    label={t("headerDescription")}
                    field="description"
                    activeField={sortField}
                    activeOrder={sortOrder}
                    onSort={onSortChange}
                    sortAscLabel={t("sortAsc")}
                    sortDescLabel={t("sortDesc")}
                  />
                  <SortableTableHead
                    label={t("headerCategory")}
                    field="category_name"
                    activeField={sortField}
                    activeOrder={sortOrder}
                    onSort={onSortChange}
                    className="w-[150px]"
                    sortAscLabel={t("sortAsc")}
                    sortDescLabel={t("sortDesc")}
                  />
                  <SortableTableHead
                    label={t("headerAccount")}
                    field="account"
                    activeField={sortField}
                    activeOrder={sortOrder}
                    onSort={onSortChange}
                    className="hidden w-[130px] md:table-cell"
                    sortAscLabel={t("sortAsc")}
                    sortDescLabel={t("sortDesc")}
                  />
                  <SortableTableHead
                    label={t("headerAmount")}
                    field="charged_amount"
                    activeField={sortField}
                    activeOrder={sortOrder}
                    onSort={onSortChange}
                    className="w-[120px]"
                    align="end"
                    sortAscLabel={t("sortAsc")}
                    sortDescLabel={t("sortDesc")}
                  />
                  <TableHead className="w-[40px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((txn) => {
                  const isIncome = txn.chargedAmount > 0;
                  const directionColor = isIncome
                    ? "var(--status-on-track)"
                    : "var(--foreground)";
                  const categoryKind: Kind = isIncome ? "income" : "expense";
                  const categoryName = txn.categoryName
                    ? translateCategoryName(txn.categoryName, tCat)
                    : t("rowUncategorized");
                  return (
                    <TableRow
                      key={txn.id}
                      className={cn(
                        "transition-colors duration-200 hover:bg-muted/50",
                        txn.isExcluded && "opacity-50",
                      )}
                    >
                      <TableCell>
                        <div style={{ color: directionColor }} className="flex items-center gap-2"><input className="size-4" type="checkbox" aria-label={t("selectRow", { name: txn.description })} disabled={editing || isFetching} checked={selected.includes(txn.id)} onChange={e => setSelected(e.target.checked ? [...selected, txn.id] : selected.filter(id => id !== txn.id))} />
                          {isIncome ? (
                            <ArrowUpRight className="h-4 w-4" aria-label={t("rowIncome")} />
                          ) : (
                            <ArrowDownRight className="h-4 w-4" aria-label={t("rowExpense")} />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm tabular-nums text-muted-foreground">
                        {formatDate(txn.date)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="font-medium">{txn.description}</div>
                          {txn.needsReview && (
                            <span
                              className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium"
                              style={{
                                backgroundColor:
                                  "color-mix(in oklch, var(--status-heads-up) 18%, transparent)",
                                color: "var(--status-heads-up)",
                              }}
                              title={
                                txn.aiConfidence != null
                                  ? t("rowReviewTooltipConfidence", { score: txn.aiConfidence })
                                  : t("rowReviewTooltipUnsure")
                              }
                            >
                              <HelpCircle className="h-3 w-3" />
                              {t("rowReview")}
                              {txn.aiConfidence != null && (
                                <span className="ms-0.5 tabular-nums">
                                  {txn.aiConfidence}/7
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                        {txn.memo && (
                          <div className="text-xs text-muted-foreground">
                            {txn.memo}
                          </div>
                        )}
                        {txn.type === "installments" &&
                          txn.installmentNumber &&
                          txn.installmentTotal && (
                            <div className="text-xs text-muted-foreground">
                              {t("rowInstallment", {
                                n: txn.installmentNumber,
                                total: txn.installmentTotal,
                              })}
                            </div>
                          )}
                        <div className="flex flex-wrap items-center gap-2">
                          {onTagClick && (
                            <TagChips id={txn.id} tags={txn.tags ?? []} allTags={allTags} onFilter={onTagClick} />
                          )}
                          {members.length >= 2 && (
                            <div className="mt-1">
                              <OwnerPicker
                                label={tTags("ownerLabel")}
                                value={txn.owner ?? null}
                                fallback={accountOwners[txn.accountNumber] ?? null}
                                members={members}
                                onChange={(owner) => void handleOwnerChange(txn.id, owner)}
                              />
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              className="inline-flex"
                              disabled={updatingId === txn.id || editing || isFetching}
                            >
                              <Badge
                                variant="outline"
                                className="cursor-pointer transition-colors hover:bg-accent"
                                style={
                                  txn.categoryColor
                                    ? {
                                        borderColor: txn.categoryColor + "40",
                                        backgroundColor: txn.categoryColor + "15",
                                        color: "var(--foreground)",
                                      }
                                    : undefined
                                }
                              >
                                {txn.allocations?.length ? t("splitCount", { count: txn.allocations.length }) : categoryName}
                              </Badge>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                              {categoriesForKind(categoryKind).map((cat) => (
                                <DropdownMenuItem
                                  key={cat.id}
                                  onClick={() =>
                                    handleCategoryChange(txn.id, cat.id)
                                  }
                                >
                                  <div
                                    className="me-2 h-2 w-2 rounded-full"
                                    style={{ backgroundColor: cat.color }}
                                  />
                                  {translateCategoryName(cat.name, tCat)}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                          {txn.needsReview && (
                            <IconButton
                              label={t("rowApprove")}
                              size="icon-xs"
                              variant="outline"
                              onClick={() => handleApprove(txn.id)}
                              disabled={updatingId === txn.id || editing || isFetching}
                              style={{
                                borderColor:
                                  "color-mix(in oklch, var(--status-on-track) 35%, transparent)",
                                color: "var(--status-on-track)",
                              }}
                            >
                              <Check className="size-3" aria-hidden />
                            </IconButton>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <TransactionSourceCell
                          provider={txn.provider}
                          accountLabel={txn.accountLabel}
                        />
                      </TableCell>
                      <TableCell
                        className="text-end font-medium tabular-nums"
                        style={{ color: directionColor }}
                      >
                        <bdi>{isIncome ? "+" : ""}{formatCurrency(txn.chargedAmount, "ILS", locale)}</bdi>
                      </TableCell>
                      <TableCell className="text-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                            disabled={updatingId === txn.id || editing || isFetching}
                            aria-label={t("rowActions")}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {txn.kind === "expense" && txn.status === "completed" && txn.chargedAmount < 0 && <DropdownMenuItem onClick={() => setSplit(txn)}>{t("splitCategories")}</DropdownMenuItem>}
                            {otherKinds[txn.kind].map((opt) => (
                              <DropdownMenuItem
                                key={opt.value}
                                onClick={() => handleKindChange(txn.id, opt.value)}
                              >
                                {opt.label}
                              </DropdownMenuItem>
                            ))}
                            {txn.isExcluded ? (
                              <DropdownMenuItem
                                onClick={() => handleExcludeToggle(txn, false)}
                              >
                                <Eye className="me-2 h-3.5 w-3.5" />
                                {t("includeAction")}
                              </DropdownMenuItem>
                            ) : (
                              <>
                                <DropdownMenuItem
                                  onClick={() => handleExcludeToggle(txn, false)}
                                >
                                  <EyeOff className="me-2 h-3.5 w-3.5" />
                                  {t("excludeAction")}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleExcludeToggle(txn, true)}
                                >
                                  <EyeOff className="me-2 h-3.5 w-3.5" />
                                  {t("excludeMerchantAction")}
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <span className="text-xs text-muted-foreground">
                  {t("paginationRange", {
                    from: page * PAGE_SIZE + 1,
                    to: Math.min((page + 1) * PAGE_SIZE, total),
                    total,
                  })}
                </span>
                <div className="flex gap-1">
                  <IconButton
                    label={t("previous")}
                    variant="outline"
                    size="icon-sm"
                    onClick={() => onPageChange(page - 1)}
                    disabled={page === 0}
                  >
                    <Back />
                  </IconButton>
                  <IconButton
                    label={t("next")}
                    variant="outline"
                    size="icon-sm"
                    onClick={() => onPageChange(page + 1)}
                    disabled={page >= totalPages - 1}
                  >
                    <Forward />
                  </IconButton>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
