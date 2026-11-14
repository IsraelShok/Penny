"use client";

import { Forward } from "@/components/ui/dir-chevron";
import { Children, useId, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations, useMessages } from "next-intl";
import { shekels } from "@/lib/money";
import { Segmented } from "@/components/ui/segmented";
import { translateCategoryName } from "@/lib/i18n-data";
import { ChevronDown, Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { IconButton } from "@/components/ui/icon-button";
import { SectionShell } from "@/components/settings/section-shell";
import { CategoryDetailSheet } from "@/components/settings/category-detail-sheet";
import { NewCategoryDialog } from "@/components/settings/new-category-dialog";
import { getMonthRange } from "@/lib/formatters";
import {
  getCategories,
  getSummary,
} from "@/lib/api";
import type { Category, CategoryKind, CategoryWithData } from "@/lib/types";

export default function CategoriesSettingsPage() {
  const t = useTranslations("settings.categories");
  const tc = useTranslations("common");
  const tCat = useTranslations("categoriesSeeded");
  const { from, to } = getMonthRange();
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => getCategories(),
  });
  const { data: summary } = useQuery({
    queryKey: ["summary", from, to],
    queryFn: () => getSummary({ from, to }),
  });

  const [search, setSearch] = useState("");
  const [activeKind, setActiveKind] = useState<CategoryKind>("expense");
  const [openId, setOpenId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  const dataByCategoryId = useMemo(() => {
    const m = new Map<number, CategoryWithData>();
    summary?.categoriesWithData.forEach((c) => m.set(c.categoryId, c));
    return m;
  }, [summary]);

  const filtered = useMemo(() => {
    if (!categories) return [];
    return categories
      .filter((c) => c.kind === activeKind)
      .filter((c) =>
        search.trim().length === 0
          ? true
          : `${c.name} ${translateCategoryName(c.name, tCat)}`.toLowerCase().includes(search.toLowerCase())
      );
  }, [categories, activeKind, search, tCat]);

  const { parents, childrenByParent, orphans } = useMemo(() => {
    const parentIds = new Set<number>();
    filtered.forEach((c) => {
      if (c.parentId != null) parentIds.add(c.parentId);
    });
    const parents = filtered
      .filter((c) => c.parentId == null && parentIds.has(c.id))
      .sort((a, b) => a.name.localeCompare(b.name));
    const childrenByParent = new Map<number, Category[]>();
    filtered.forEach((c) => {
      if (c.parentId != null) {
        const list = childrenByParent.get(c.parentId) ?? [];
        list.push(c);
        childrenByParent.set(c.parentId, list);
      }
    });
    childrenByParent.forEach((list) =>
      list.sort((a, b) => a.name.localeCompare(b.name))
    );
    const orphans = filtered
      .filter((c) => c.parentId == null && !parentIds.has(c.id))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { parents, childrenByParent, orphans };
  }, [filtered]);

  return (
    <>
      <SectionShell
        title={t("title")}
        description={t("description")}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            className="rounded-full bg-card p-0.5"
            label={t("title")}
            value={activeKind}
            onChange={setActiveKind}
            options={[{ value: "expense", label: t("tabExpense") }, { value: "income", label: t("tabIncome") }]}
          />
          <div className="relative flex-1 min-w-[180px]">
            <Search aria-hidden className="pointer-events-none absolute start-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchPlaceholder")}
              className="ps-8"
            />
          </div>
          <IconButton label={t("newCategoryButton")} variant="outline" onClick={() => setCreating(true)}>
            <Plus aria-hidden className="size-4" />
          </IconButton>
          <NewCategoryDialog open={creating} onOpenChange={setCreating} kind={activeKind} />
        </div>

        {!categories ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            {tc("loading")}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            {t("noMatching")}
          </div>
        ) : (
          <div className="space-y-6">
            {parents.map((parent) => (
              <GroupBlock
                key={parent.id}
                title={translateCategoryName(parent.name, tCat)}
                color={parent.color}
                parent={parent}
                onSelect={setOpenId}
                dataById={dataByCategoryId}
              >
                {childrenByParent.get(parent.id)?.map((child) => (
                  <CategoryRow
                    key={child.id}
                    category={child}
                    data={dataByCategoryId.get(child.id) ?? null}
                    onSelect={() => setOpenId(child.id)}
                  />
                ))}
              </GroupBlock>
            ))}
            {orphans.length > 0 ? (
              <GroupBlock
                title={t("ungrouped")}
                color="#9ca3af"
                onSelect={setOpenId}
                dataById={dataByCategoryId}
              >
                {orphans.map((cat) => (
                  <CategoryRow
                    key={cat.id}
                    category={cat}
                    data={dataByCategoryId.get(cat.id) ?? null}
                    onSelect={() => setOpenId(cat.id)}
                  />
                ))}
              </GroupBlock>
            ) : null}
          </div>
        )}
      </SectionShell>

      <CategoryDetailSheet
        categoryId={openId}
        data={openId != null ? (dataByCategoryId.get(openId) ?? null) : null}
        onClose={() => setOpenId(null)}
      />
    </>
  );
}

function GroupBlock({
  title,
  color,
  parent,
  children,
  onSelect,
}: {
  title: string;
  color: string;
  parent?: Category;
  dataById: Map<number, CategoryWithData>;
  children: React.ReactNode;
  onSelect: (id: number) => void;
}) {
  const t = useTranslations("settings.categories");
  const tp = useTranslations("categoryPicker");
  const [open, setOpen] = useState(true);
  const listId = useId();
  return (
    <section>
      <div className="mb-2 flex items-center gap-2 px-1">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((o) => !o)}
          className="flex min-h-11 min-w-0 items-center gap-2 rounded-md text-start focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ChevronDown aria-hidden className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "" : "-rotate-90 rtl:rotate-90"}`} />
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
          <span title={title} className="truncate text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{title}</span>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground/80">{tp("subcount", { count: Children.count(children) })}</span>
        </button>
        {parent ? (
          <button
            type="button"
            onClick={() => onSelect(parent.id)}
            className="ms-auto text-xs uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground"
          >
            {t("editGroup")}
          </button>
        ) : null}
      </div>
      <div id={listId} hidden={!open} className="overflow-hidden rounded-2xl bg-card">
        <ul className="divide-y divide-border/60">{children}</ul>
      </div>
    </section>
  );
}

function CategoryRow({
  category,
  data,
  onSelect,
}: {
  category: Category;
  data: CategoryWithData | null;
  onSelect: () => void;
}) {
  const t = useTranslations("settings.categories");
  const tCat = useTranslations("categoriesSeeded");
  // Read the raw messages: names like "Sports & Hobbies" trip next-intl's key lookup.
  const descriptions = (useMessages() as { categoryDescriptions?: Record<string, string> }).categoryDescriptions ?? {};
  const locale = useLocale();
  const stored = category.description?.trim();
  // Seeded descriptions are English (the categorizer reads them); show the translation unless the user wrote their own.
  const translated = descriptions[category.name] ?? "";
  // Seeded descriptions start in English (some mention Hebrew brand names); a user's own Hebrew text stays.
  const latin = (stored?.match(/[A-Za-z]/g) ?? []).length;
  const hebrew = (stored?.match(/[֐-׿]/g) ?? []).length;
  const description = stored && (latin > hebrew || /^[A-Za-z]/.test(stored)) && translated ? translated : stored;
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-muted/50"
      >
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: category.color }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="truncate" title={translateCategoryName(category.name, tCat)}>{translateCategoryName(category.name, tCat)}</span>
          </div>
          {description ? (
            <div dir="auto" title={description} className="mt-0.5 truncate text-start text-xs text-muted-foreground">
              {description}
            </div>
          ) : null}
        </div>
        <div className="hidden shrink-0 text-end sm:block">
          {data ? (
            <div className="text-xs tabular-nums text-muted-foreground">
              {t("spentLabel", { amount: shekels(Math.round(data.spent), locale) })}
            </div>
          ) : null}
        </div>
        <BudgetChip category={category} data={data} />
        <Forward className="text-muted-foreground/60" />
      </button>
    </li>
  );
}

function BudgetChip({
  category,
  data,
}: {
  category: Category;
  data: CategoryWithData | null;
}) {
  const locale = useLocale();
  const t = useTranslations("settings.categories");
  if (category.budgetMode === "tracking") {
    return (
      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        {t("tracking")}
      </span>
    );
  }
  if (!data || data.budget <= 0) {
    return (
      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        {t("noBudget")}
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full bg-foreground/8 px-2 py-0.5 text-xs font-medium tabular-nums">
      {shekels(Math.round(data.budget), locale)}
    </span>
  );
}
