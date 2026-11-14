"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, Plus, AlertCircle, Menu, MoreVertical, Landmark, CalendarDays, Tags, ArrowLeftRight, PiggyBank, Settings, SlidersHorizontal, Search } from "lucide-react";
import { Forward } from "@/components/ui/dir-chevron";
import { MonthNav, MonthStrip, monthKey, shiftMonth } from "@/components/ui/month-nav";
import { translateCategoryName } from "@/lib/i18n-data";
import { toast } from "sonner";
import {
  getAssets, getBudgets, getCashAhead, getCategories, getHome, getOverview, getTransactions,
  updateBudget, updateCategoryBudgetMode,
} from "@/lib/api";
import { usePlan } from "@/hooks/use-plan";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { shekels } from "@/lib/money";
import { wealthGroups, type WealthGroup } from "@/lib/wealth-growth";
import { buildCashflow, cashflowMonth, trackedRows, type Week } from "@/lib/simple-cashflow";

/**
 * Simple mode: one scrolling page, one card per cash-flow line, newest month first.
 * Order: month bar, end-of-month forecast, variable spending by week, each tracked category,
 * savings deposits, fixed costs, total, income (with savings growth), off-cash-flow.
 */
/** `cardOnly`: just this month's forecast card , for Advanced mode's Home. */
export function SimpleHome({ name, cardOnly, extra, heroAside }: { name?: string | null; cardOnly?: boolean; /** Shown under the bank balance (Advanced mode puts its next step here). */ extra?: React.ReactNode; /** Beside the forecast figure, at the end side (visual left in Hebrew); shrinks on phones. */ heroAside?: React.ReactNode }) {
  const formatCurrency = useMoney();
  const t = useTranslations("home.simple");
  const locale = useLocale();
  const [offset, setOffset] = useState(0);
  // Desktop: which line the detail panel shows.
  const [selected, setSelected] = useState("variable");

  const queryClient = useQueryClient();
  const tCat = useTranslations("categoriesSeeded");
  const tManual = useTranslations("manualTxn");
  const catName = (n: string) => translateCategoryName(n, tCat);
  // One month start for the whole app: the plan's, which the overview API also uses.
  const { plan, loaded: planLoaded, failed: planFailed } = usePlan();
  const { from: first, to: last } = cashflowMonth(plan.monthStartDay, offset);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  // Named after the month most of the range falls in.
  const monthName = new Date(first.getFullYear(), first.getMonth(), first.getDate() + 14).toLocaleDateString(locale, { month: "long", year: "numeric" });
  // The month picker speaks "YYYY-MM"; this page counts months back from the current one.
  const month = monthKey(new Date(first.getFullYear(), first.getMonth(), first.getDate() + 14));
  const thisMonth = shiftMonth(month, offset);
  const goMonth = (m: string) => { const [y, mo] = m.split("-").map(Number), [cy, cm] = thisMonth.split("-").map(Number); setOffset(Math.max(0, (cy - y) * 12 + cm - mo)); };
  const monthNav = <MonthNav value={month} onChange={goMonth} max={thisMonth} />;

  const txns = useQuery({
    queryKey: ["simple-txns", iso(first), iso(last)],
    queryFn: () => getAllTransactions(iso(first), iso(last)),
    // Wait for the plan, so the range never jumps from the 1st to the start day mid-load.
    enabled: planLoaded || planFailed,
  });
  // The whole previous month is the baseline for "expected" (the API's own `previous` stops at today's day).
  const overview = useQuery({ queryKey: ["overview", "month", offset + 1], queryFn: () => getOverview("month", offset + 1) });
  const cats = useQuery({ queryKey: ["categories"], queryFn: () => getCategories() });
  const budgets = useQuery({ queryKey: ["budgets"], queryFn: getBudgets });
  const assets = useQuery({ queryKey: ["assets"], queryFn: getAssets, enabled: offset === 0 });
  const cash = useQuery({ queryKey: ["cash-ahead"], queryFn: getCashAhead, enabled: offset === 0 });
  // Freshness from the per-bank health Home already loads: the newest sync, or a failure if any bank failed.
  const banks = useQuery({ queryKey: ["home"], queryFn: getHome }).data?.bankHealth ?? [];
  const lastAt = banks.map((b) => b.lastSyncAt).filter((d): d is string => !!d).sort().at(-1) ?? null;
  const run: Run = banks.some((b) => b.status === "error") ? { failed: true, at: lastAt } : lastAt ? { failed: false, at: lastAt } : null;
  const refresh = () => {
    for (const key of ["budgets", "categories", "home", "overview", "simple-txns", "cash-ahead"]) void queryClient.invalidateQueries({ queryKey: [key] });
  };
  const act = (p: Promise<unknown>) => p.then(refresh, (e: unknown) => { toast.error(t("saveFailed")); throw e; });
  const queries = [txns, overview, cats, budgets];
  const failed = queries.some((q) => q.isError);
  const retry = () => { for (const q of queries) if (q.isError) void q.refetch(); };

  const ready = txns.data && overview.data && cats.data && budgets.data;
  const cf = ready ? buildCashflow(txns.data!, cats.data!, budgets.data!, overview.data!, { from: first, to: last }) : null;
  // Anything that isn't a fixed bill or savings can be tracked (variable and unplanned alike); parents roll up their children.
  const parentIds = new Set((cats.data ?? []).map((c) => c.parentId).filter((x): x is number => x != null));
  const trackable = (cats.data ?? []).filter((c) => c.kind === "expense" && c.costType !== "fixed" && c.needType !== "saving" && !parentIds.has(c.id));
  const groups = assets.data ? wealthGroups(assets.data.assets) : null;
  const wealth = groups ? (Object.keys(groups) as WealthGroup[]).filter((g) => groups[g].value > 0) : [];

  return (
    <div className={cardOnly ? "" : "mx-auto max-w-md lg:max-w-6xl"}>
      {/* Menu and quick-add (opens the add sheet on Transactions); the month picker lives in the card below. */}
      <div className="mb-2 flex items-center justify-between gap-2">{!cardOnly ? <SimpleMenu name={name} run={run} /> : <span />}<Link href="/transactions?add=1" className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-primary hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"><Plus className="size-4" aria-hidden />{tManual("addTitle")}</Link></div>
      {failed ? (
        <Card>
          <div role="alert" className="flex flex-col items-start gap-3 p-5 sm:p-6">
            <p className="text-headline font-semibold">{t("loadFailed")}</p>
            <button type="button" onClick={retry} className="min-h-11 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground">{t("tryAgain")}</button>
          </div>
        </Card>
      ) : !cf ? (
        <div className="wallet h-64 rounded-3xl px-5 pt-[22px] min-[600px]:rounded-[28px] min-[600px]:px-[30px] min-[600px]:pt-7"><div className="flex justify-end">{monthNav}</div><div role="status" className="mt-6 h-24 animate-pulse rounded-2xl bg-white/10"><span className="sr-only">{t("loading")}</span></div></div>
      ) : (() => {
        const growthTotal = wealth.reduce((sum, g) => sum + groups![g].growth, 0);
        const growthList = (
          <>
            <ul className="divide-y divide-border text-sm">
              {wealth.map((g) => (
                <li key={g} className="flex items-center justify-between py-2.5">
                  <span>{t(g)}<span className="block text-xs text-muted-foreground">{t("worth", { value: formatCurrency(groups![g].value) })}</span></span>
                  <span className="font-medium tabular-nums text-status-on-track">{groups![g].estimated ? <Signed n={groups![g].growth} /> : "—"}</span>
                </li>
              ))}
            </ul>
            <p className="pb-2 text-xs text-muted-foreground">{t("estimateNote")}</p>
          </>
        );

        // Every cash-flow line once; phones render them as cards, desktop as a chart plus one detail panel.
        // Every picked category stays (₪0 included); with many, the smallest fold into one "more" line.
        const rows = trackedRows(cf.tracked);
        const tracked: LineView[] = rows.shown
          .map((c) => ({
            key: `cat-${c.id}`, title: catName(c.name), tone: c.color, spent: c.spent, expected: c.expected,
            spentLabel: t("spent"), expectedLabel: t("expected"), showLeft: true,
            menu: (
              <CardMenu
                label={catName(c.name)}
                expected={c.expected}
                onSave={(v) => act(updateBudget(c.id, v))}
                onStop={() => void act(updateBudget(c.id, null).then(() => updateCategoryBudgetMode(c.id, "tracking"))).catch(() => {})}
              />
            ),
            sections: [
              { label: t("byWeek"), content: <WeeksList weeks={c.weeks} /> },
              ...(c.items.length ? [{ label: t("details"), content: <Items items={c.items} /> }] : []),
            ],
          }));
        if (rows.rest.length) {
          const sum = (k: "spent" | "expected") => rows.rest.reduce((s, c) => s + c[k], 0);
          tracked.push({
            key: "more", title: t("moreCategories", { count: rows.rest.length }), tone: "var(--muted-foreground)",
            spent: sum("spent"), expected: sum("expected"), spentLabel: t("spent"), expectedLabel: t("expected"),
            sections: [{ label: t("details"), content: <CompactRows rows={rows.rest.map((c) => ({ id: c.id, name: catName(c.name), spent: c.spent, expected: c.expected, tone: c.color }))} /> }],
          });
        }
        const variableLine: LineView = {
          key: "variable", title: t("variable"), tone: "var(--chart-1)", spent: cf.variable.spent, expected: cf.variable.expected,
          spentLabel: t("spent"), expectedLabel: t("recommended"), sections: [{ label: t("byWeek"), content: <WeeksList weeks={cf.weeks} /> }],
        };
        const savingsLine: LineView = {
          key: "savings", title: t("savingsDeposits"), tone: RING.savings, spent: cf.savings.spent, expected: cf.savings.expected,
          spentLabel: t("deposited"), expectedLabel: t("expected"),
          sections: cf.savings.items.length ? [{ label: t("details"), content: <Items items={cf.savings.items} /> }] : [],
        };
        const fixedLine: LineView = {
          key: "fixed", title: t("fixed"), tone: "var(--chart-5)", spent: cf.fixed.spent, expected: cf.fixed.expected,
          spentLabel: t("spent"), expectedLabel: t("expected"),
          sections: cf.fixed.items.length ? [{ label: t("details"), content: <Items items={cf.fixed.items} /> }] : [],
        };
        const incomeLine: LineView = {
          key: "income", title: t("income"), tone: RING.income, spent: cf.income.received, expected: cf.income.expected,
          spentLabel: t("received"), expectedLabel: t("expectedIn"),
          sections: [
            { label: t("incomeFixed"), content: <Items items={cf.income.fixed} /> },
            { label: t("incomeVariable"), content: <Items items={cf.income.variable} /> },
            ...(offset === 0 && wealth.length > 0 ? [{ label: t("wealthGrowth"), total: growthTotal, content: growthList }] : []),
          ],
        };
        const offLine: LineView = {
          key: "off", title: t("offCashflow"), tone: "var(--muted-foreground)", spent: cf.off.expenseTotal, expected: 0,
          spentLabel: t("spent"), expectedLabel: t("expected"), noMeter: true,
          sections: [
            { label: t("offIncome"), total: cf.off.incomeTotal, content: <Items items={cf.off.income} /> },
            { label: t("offExpenses"), total: cf.off.expenseTotal, content: <Items items={cf.off.expenses} /> },
          ],
        };
        const lines = [variableLine, ...tracked, savingsLine, fixedLine, incomeLine, offLine];
        const current = lines.find((l) => l.key === selected) ?? variableLine;

        const spentPct = cf.totalExpected > 0 ? Math.min(100, (cf.totalSpent / cf.totalExpected) * 100) : cf.totalSpent > 0 ? 100 : 0;
        const hero = (
          // Same frame as the Budget and Overview heroes (.studio-overview): 28/30px padding, 28px corners, month on the end side.
          <section className="wallet shrink-0 overflow-hidden rounded-3xl px-5 pb-4 pt-[22px] shadow-sm min-[600px]:rounded-[28px] min-[600px]:px-[30px] min-[600px]:pb-5 min-[600px]:pt-7">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-footnote text-muted-foreground">
              <span className="min-w-0 truncate">{name && !cardOnly ? t("hi", { name }) : <SyncLine run={run} />}</span>
              {monthNav}
            </div>
            {name && !cardOnly && <div className="mt-1 text-footnote text-muted-foreground"><SyncLine run={run} /></div>}
            <div className="hero-with-aside"><div className="min-w-0 flex-1">
            <h2 className="mt-4 text-sm font-medium text-pretty">{t(offset === 0 ? "forecastTitle" : "endedTitle", { month: monthName })}</h2>
            {cf.forecast < 0 && <p className="mt-2 flex items-center gap-1 text-footnote font-medium text-status-heads-up"><AlertCircle className="size-4 shrink-0" aria-hidden />{t("forecastShort")}</p>}
            <p className={`studio-amount figure ${cf.forecast < 0 ? "text-status-heads-up" : ""}`}>
              <Signed n={cf.forecast} />
            </p>
            {offset === 0 && <BalancePill bank={cash.data?.bank ?? null} accounts={cash.data?.accounts ?? []} />}
            </div>{heroAside && <div className="hero-aside">{heroAside}</div>}</div>
            <div className="mt-5">
              <div className="flex items-baseline justify-between gap-3 text-footnote">
                <span className="text-muted-foreground">{t("spentSoFar")}</span>
                <span className="tabular-nums"><bdi className="font-semibold">{formatCurrency(cf.totalSpent)}</bdi> / <bdi className="text-muted-foreground">{formatCurrency(cf.totalExpected)}</bdi></span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/15" role="progressbar"
                aria-valuenow={Math.round(spentPct)} aria-valuemin={0} aria-valuemax={100} aria-label={t("spentSoFar")}
                aria-valuetext={t("meterText", { spent: formatCurrency(cf.totalSpent), expected: formatCurrency(cf.totalExpected) })}>
                <div className="h-full rounded-full" style={{ width: `${spentPct}%`, background: RING.spending }} />
              </div>
            </div>
            {extra}
            <MonthStrip value={month} onChange={goMonth} max={thisMonth} />
          </section>
        );
        const trackButton = (
          <TrackPicker
            options={trackable.map((c) => ({ id: c.id, name: catName(c.name), on: c.budgetMode === "budgeted" }))}
            onChange={(ids, on) => {
              if (on && ids.length === 1) setSelected(`cat-${ids[0]}`);
              void act(Promise.all(ids.map((id) => updateCategoryBudgetMode(id, on ? "budgeted" : "tracking")))).catch(() => {});
            }}
          />
        );
        const panel = (l: LineView) => (
          <>
            <Head title={l.title}>{l.menu}</Head>
            {!l.noMeter && <Meter title={l.title} spent={l.spent} expected={l.expected} spentLabel={l.spentLabel} expectedLabel={l.expectedLabel} tone={l.tone} showLeft={l.showLeft} />}
            {l.noMeter && <div className="h-3" />}
            {l.sections.map((s) => <Expand key={s.label} id={`home.${l.key}.${s.label}`} label={s.label} total={s.total}>{s.content}</Expand>)}
          </>
        );
        const card = (l: LineView) => <Card key={l.key}>{panel(l)}</Card>;

        // Advanced mode borrows just the forecast card.
        if (cardOnly) return <div className="mb-6 md:mb-8">{hero}</div>;

        return (
          <>
            {/* Phone and tablet: one scrolling column. */}
            <div className="space-y-3 lg:hidden">
              {hero}
              {[variableLine, ...tracked].map((l) => card(l))}
              {trackButton}
              {[savingsLine, fixedLine, incomeLine, offLine].map((l) => card(l))}
            </div>

            {/* Desktop, top to bottom: the forecast card, the chart across the full width so every column fits one row,
                then the picked line's detail. No fixed viewport height: the taller hero squeezed the chart and panel to nothing. */}
            <div className="hidden lg:flex lg:flex-col lg:gap-3">
              {hero}
              <Card>
                <div className="px-3 pt-3">
                  <div className="flex items-center justify-between gap-4 px-2">
                    <h2 className="text-headline font-semibold">{t("linesTitle")}</h2>
                    <div className="w-60 shrink-0">{trackButton}</div>
                  </div>
                  <LinesChart lines={lines} selected={current.key} onSelect={setSelected} label={t("linesTitle")} />
                </div>
              </Card>
              <section aria-live="polite" aria-label={current.title} className="overflow-hidden rounded-2xl border border-border/60 bg-card pb-2">
                <div key={current.key}>{panel(current)}</div>
              </section>
            </div>
          </>
        );
      })()}
    </div>
  );
}

type LineView = {
  key: string; title: string; tone: string; spent: number; expected: number;
  spentLabel: string; expectedLabel: string; showLeft?: boolean; noMeter?: boolean;
  menu?: React.ReactNode;
  sections: { label: string; total?: number; content: React.ReactNode }[];
};

/** One column per cash-flow line: the track is what's expected, the fill is what happened. Click to open it below. */
function LinesChart({ lines, selected, onSelect, label }: { lines: LineView[]; selected: string; onSelect: (k: string) => void; label: string }) {
  const formatCurrency = useMoney();
  return (
    <div role="group" aria-label={label} className="grid grid-cols-[repeat(auto-fit,minmax(4.5rem,1fr))] gap-1 px-1 pb-2 pt-2">
      {lines.map((l) => {
        const sel = l.key === selected;
        const pct = l.expected > 0 ? Math.min(100, (l.spent / l.expected) * 100) : l.spent > 0 ? 100 : 0;
        const over = l.showLeft && l.expected > 0 && l.spent > l.expected;
        return (
          <button
            key={l.key}
            type="button"
            aria-pressed={sel}
            onClick={() => onSelect(l.key)}
            className={`flex h-28 min-w-0 flex-col items-center gap-1 rounded-xl px-1.5 pb-1.5 pt-2 transition-colors focus-visible:outline-2 focus-visible:outline-ring ${sel ? "bg-accent ring-1 ring-primary/30" : "hover:bg-accent/60"}`}
          >
            <bdi className="text-xs font-semibold tabular-nums">{formatCurrency(l.spent)}</bdi>
            <span className="relative flex w-7 flex-1 items-end overflow-hidden rounded-lg" style={{ background: `color-mix(in oklab, ${l.tone} 16%, transparent)` }} aria-hidden>
              <span className="w-full rounded-lg transition-[height] duration-500" style={{ height: `${pct}%`, background: over ? "var(--status-over)" : l.tone }} />
            </span>
            <span className={`line-clamp-2 w-full break-words text-center text-xs leading-tight ${sel ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{l.title}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Which categories get their own row: searchable checklist with select/clear all and a count. */
function TrackPicker({ options, onChange }: { options: { id: number; name: string; on: boolean }[]; onChange: (ids: number[], on: boolean) => void }) {
  const t = useTranslations("home.simple");
  const [q, setQ] = useState("");
  const count = options.filter((o) => o.on).length;
  const shown = options.filter((o) => o.name.toLowerCase().includes(q.trim().toLowerCase()));
  const bulk = (on: boolean) => { const ids = shown.filter((o) => o.on !== on).map((o) => o.id); if (ids.length) onChange(ids, on); };
  return (
    <Popover>
      <PopoverTrigger className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/40 px-4 text-sm font-medium text-primary hover:bg-accent disabled:opacity-50 max-lg:min-h-14" disabled={options.length === 0}>
        <Plus className="size-4" aria-hidden /> {t("trackCategory")}
        {count > 0 && <span className="rounded-full bg-primary/10 px-2 text-xs tabular-nums">{count}</span>}
      </PopoverTrigger>
      <PopoverContent className="flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchCategories") + "…"} aria-label={t("searchCategories")}
            className="min-h-11 w-full rounded-lg border border-border bg-background ps-8 pe-2 text-sm" />
        </div>
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground" aria-live="polite">{t("selectedCount", { count, total: options.length })}</span>
          <span className="flex gap-1">
            <button type="button" className="min-h-9 rounded-md px-2 font-medium text-primary hover:bg-accent" onClick={() => bulk(true)}>{t("selectAll")}</button>
            <button type="button" className="min-h-9 rounded-md px-2 font-medium text-primary hover:bg-accent" onClick={() => bulk(false)}>{t("clearAll")}</button>
          </span>
        </div>
        <ul className="max-h-72 overflow-y-auto">
          {shown.map((o) => (
            <li key={o.id}>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm hover:bg-accent">
                <input type="checkbox" checked={o.on} onChange={(e) => onChange([o.id], e.target.checked)} className="size-4 accent-[var(--primary)]" />
                <span className="min-w-0 flex-1 truncate">{o.name}</span>
              </label>
            </li>
          ))}
          {shown.length === 0 && <li className="px-2 py-3 text-sm text-muted-foreground">{t("noMatches")}</li>}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

/** Folded categories: one compact line each; ₪0 ones stay, dimmed, so nothing vanishes silently. */
function CompactRows({ rows }: { rows: { id: number; name: string; spent: number; expected: number; tone: string }[] }) {
  const formatCurrency = useMoney();
  return (
    <ul className="divide-y divide-border pb-1 text-sm">
      {rows.map((r) => {
        const pct = r.expected > 0 ? Math.min(100, (r.spent / r.expected) * 100) : r.spent > 0 ? 100 : 0;
        return (
          <li key={r.id} className={`py-2 ${r.spent === 0 ? "text-muted-foreground" : ""}`}>
            <div className="flex items-baseline justify-between gap-3">
              <bdi className="min-w-0 truncate">{r.name}</bdi>
              <span className="shrink-0 tabular-nums"><bdi>{formatCurrency(r.spent)}</bdi>{r.expected > 0 && <span className="text-xs text-muted-foreground"> / <bdi>{formatCurrency(r.expected)}</bdi></span>}</span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: r.spent > r.expected && r.expected > 0 ? "var(--status-over)" : r.tone }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Bank balance, with the accounts behind it, without leaving Simple mode. */
function BalancePill({ bank, accounts }: { bank: number | null; accounts: { provider: string; accountNumber: string; balance: number; updatedAt: string }[] }) {
  const t = useTranslations("home.simple");
  const formatCurrency = useMoney();
  return (
    <Popover>
      <PopoverTrigger className="-ms-2 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-footnote text-muted-foreground hover:bg-white/10 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
        {t("bankBalance")}
        <span className="font-medium tabular-nums">{bank != null ? <Signed n={bank} /> : "—"}</span>
        <ChevronDown className="size-4" aria-hidden />
      </PopoverTrigger>
      <PopoverContent className="w-72">
        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noBalance")}</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {accounts.map((a) => (
              <li key={`${a.provider}-${a.accountNumber}`} className="flex items-center justify-between gap-3 py-2">
                <bdi className="truncate">{a.provider} · ••••{a.accountNumber.slice(-4)}</bdi>
                <span className="tabular-nums">{a.balance < 0 ? <Signed n={a.balance} /> : <bdi>{formatCurrency(a.balance)}</bdi>}</span>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Ring colors: lavender, gold and sky, readable on the dark hero in every theme. */
const RING = { income: "var(--ring-income)", spending: "var(--ring-spending)", savings: "var(--ring-savings)" } as const;

/** Signed amount; shekels() keeps the minus with the number inside an isolate, so it never flips in RTL. */
function Signed({ n }: { n: number }) {
  return <>{shekels(n, useLocale())}</>;
}

/** Every transaction in the range, page by page (the API caps a page at 200). */
async function getAllTransactions(from: string, to: string) {
  const PAGE = 200;
  const all: Awaited<ReturnType<typeof getTransactions>>["transactions"] = [];
  for (let offset = 0; ; offset += PAGE) {
    const page = await getTransactions({ from, to, kind: "all", limit: PAGE, offset });
    all.push(...page.transactions);
    if (page.transactions.length < PAGE || all.length >= page.total) break;
  }
  return all;
}

/** Amounts as the rest of the app shows them: whole shekels, sign handled by the caller. */
function useMoney() {
  const locale = useLocale();
  return (n: number) => shekels(Math.abs(n), locale);
}

/** Same surface as Advanced's CardShell, so Appearance settings (theme, glass, density) apply here too. */
function Card({ children }: { children: React.ReactNode }) {
  return <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">{children}</section>;
}

function Head({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2 px-5 pt-5 sm:px-6">
      <h2 className="card-title">{title}</h2>
      {children}
    </div>
  );
}

/** ⋮ on a tracked category: change what is expected this month, or stop tracking it. */
function CardMenu({ label, expected, onSave, onStop }: { label: string; expected: number; onSave: (v: number) => Promise<unknown>; onStop: () => void }) {
  const t = useTranslations("home.simple");
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  if (editing) {
    return (
      <form
        className="flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          const v = Number(value);
          if (value === "" || !Number.isFinite(v) || v < 0) return;
          onSave(Math.round(v)).then(() => setEditing(false), () => {});
        }}
      >
        <input
          autoFocus
          type="number"
          min={0}
          inputMode="numeric"
          aria-label={t("expectedFor", { name: label })}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="min-h-11 w-24 rounded-lg border border-border bg-background px-2 text-sm tabular-nums"
        />
        <button type="submit" className="min-h-11 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground">{t("save")}</button>
        <button type="button" className="min-h-11 rounded-lg px-3 text-sm text-muted-foreground hover:bg-accent" onClick={() => setEditing(false)}>{t("cancel")}</button>
      </form>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="-me-2 -mt-2 grid size-11 place-items-center rounded-full hover:bg-accent" aria-label={t("cardMenu", { name: label })}>
        <MoreVertical className="h-5 w-5" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => { setValue(String(Math.round(expected))); setEditing(true); }}>{t("editExpected")}</DropdownMenuItem>
        <DropdownMenuItem onClick={onStop}>{t("stopTracking")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type Run = { failed: boolean; at: string | null } | null;

/** When the data last synced; a failed sync links to the bank settings. */
function SyncLine({ run }: { run: Run }) {
  const t = useTranslations("home.simple");
  const locale = useLocale();
  if (!run) return null;
  if (run.failed) {
    return (
      <Link href="/settings/bank" className="flex items-center gap-1 text-[var(--status-over)]">
        <AlertCircle className="h-3.5 w-3.5" aria-hidden />{t("syncFailed")}
      </Link>
    );
  }
  if (!run.at) return null;
  const at = new Date(run.at);
  return <span>{t("updated", { when: at.toLocaleString(locale, { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }) })}</span>;
}

/** ☰: everything Simple mode needs that is not on the page. */
function SimpleMenu({ name, run }: { name?: string | null; run: Run }) {
  const t = useTranslations("home.simple");
  const { update } = usePlan();
  const links: [string, string, typeof Landmark][] = [
    ["/settings/bank", t("menuAccounts"), Landmark],
    ["/settings/general", t("menuStartDay"), CalendarDays],
    ["/settings/categories", t("menuCategories"), Tags],
    ["/transactions", t("menuTransactions"), ArrowLeftRight],
    ["/investments", t("menuSavings"), PiggyBank],
    ["/settings", t("menuSettings"), Settings],
  ];
  return (
    <Sheet>
      <SheetTrigger className="grid size-11 place-items-center rounded-full hover:bg-accent" aria-label={t("menu")}>
        <Menu className="h-5 w-5" aria-hidden />
      </SheetTrigger>
      {/* "left" is the start side in this Sheet: right in Hebrew, left in English, next to the ☰. */}
      <SheetContent side="left" className="w-80 max-w-full">
        <SheetHeader>
          <SheetTitle>{name || t("menu")}</SheetTitle>
          <div className="text-xs text-muted-foreground"><SyncLine run={run} /></div>
        </SheetHeader>
        <nav className="flex flex-col px-2">
          {links.map(([href, label, Icon]) => (
            <Link key={href} href={href} className="flex min-h-12 items-center gap-3 rounded-xl px-3 hover:bg-accent">
              <Icon className="size-5 shrink-0 text-primary" aria-hidden />
              <span className="flex-1">{label}</span>
              <Forward className="text-muted-foreground" />
            </Link>
          ))}
          <button type="button" className="mt-3 flex min-h-12 items-center gap-3 rounded-xl border border-border px-3 text-start hover:bg-accent" onClick={() => void update({ simpleMode: false })}>
            <SlidersHorizontal className="size-5 shrink-0 text-primary" aria-hidden />
            {t("toAdvanced")}
          </button>
        </nav>
      </SheetContent>
    </Sheet>
  );
}


function Meter({ title, spent, expected, spentLabel, expectedLabel, tone, showLeft }: {
  title: string; spent: number; expected: number; spentLabel: string; expectedLabel: string; tone: string; showLeft?: boolean;
}) {
  const t = useTranslations("home.simple");
  const formatCurrency = useMoney();
  const pct = expected > 0 ? Math.min(100, (spent / expected) * 100) : spent > 0 ? 100 : 0;
  const over = spent - expected;
  const isOver = showLeft && over > 0;
  const bar = isOver ? "var(--status-over)" : tone;
  return (
    <div className="px-5 pb-5 pt-3 sm:px-6">
      <div className="flex justify-between text-xs text-muted-foreground"><span>{spentLabel}</span><span>{expectedLabel}</span></div>
      <div className="flex justify-between text-lg tabular-nums">
        {/* The ring tones are pale (made for the dark hero); pulled toward the text color so they stay readable on light cards. */}
        <bdi className="font-semibold" style={{ color: `color-mix(in oklab, ${tone} 55%, var(--foreground))` }}>{formatCurrency(spent)}</bdi>
        <bdi className="text-muted-foreground">{formatCurrency(expected)}</bdi>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full" style={{ background: `color-mix(in oklab, ${bar} 18%, transparent)` }} role="progressbar"
        aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={title}
        aria-valuetext={t("meterText", { spent: formatCurrency(spent), expected: formatCurrency(expected) })}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: bar }} />
      </div>
      {showLeft && (
        <p className={`mt-2 flex items-center gap-1 text-xs font-semibold ${isOver ? "text-status-over" : ""}`}>
          {isOver && <AlertCircle className="size-3.5" aria-hidden />}
          {isOver ? t("overBy", { amount: formatCurrency(over) }) : t("leftAmount", { amount: formatCurrency(-over) })}
        </p>
      )}
    </div>
  );
}

/** A line's month by weeks: per week what was spent of its budget, a bar, and what is left or over. This week stands out. */
function WeeksList({ weeks }: { weeks: Week[] }) {
  const t = useTranslations("home.simple");
  const formatCurrency = useMoney();
  const dates = new Intl.DateTimeFormat(useLocale(), { day: "numeric", month: "numeric" });
  return (
    <div className="pb-3">
      <p className="flex justify-end pb-1 text-xs text-muted-foreground">{t("spent")} / {t("weekBudget")}</p>
      <ol className="-mx-3 space-y-1">
        {weeks.map((w, i) => {
          const over = w.left < 0;
          const pct = w.share > 0 ? Math.min(100, (w.spent / w.share) * 100) : w.spent > 0 ? 100 : 0;
          const tone = over ? "var(--expense)" : "var(--status-on-track)";
          return (
            <li key={i} aria-current={w.current ? "date" : undefined}
              className={`rounded-xl px-3 py-2.5 ${w.current ? "bg-accent ring-1 ring-primary/30" : ""} ${w.future ? "text-muted-foreground" : ""}`}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
                  {t("week", { n: i + 1 })}
                  {w.current && <span className="rounded-full bg-primary px-2 py-px text-[11px] font-semibold text-primary-foreground">{t("thisWeek")}</span>}
                </span>
                <span className="shrink-0 text-sm tabular-nums">
                  <bdi className="font-semibold">{formatCurrency(w.spent)}</bdi>
                  <span className="text-muted-foreground"> / <bdi>{formatCurrency(w.share)}</bdi></span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar"
                aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={t("week", { n: i + 1 })}
                aria-valuetext={t("meterText", { spent: formatCurrency(w.spent), expected: formatCurrency(w.share) })}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: tone }} />
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-2 text-xs">
                <bdi className="tabular-nums text-muted-foreground">{dates.formatRange(w.from, w.to)}</bdi>
                <span className={`flex items-center gap-1 font-medium tabular-nums ${w.future ? "" : over ? "text-expense" : "text-status-on-track"}`}>
                  {over && <AlertCircle className="size-3.5" aria-hidden />}
                  {over ? t("overBy", { amount: formatCurrency(w.left) }) : t("leftAmount", { amount: formatCurrency(w.left) })}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** A card's section, always shown: a label row, then its content. */
function Expand({ label, total, children }: { id: string; label: string; total?: number; children: React.ReactNode }) {
  const formatCurrency = useMoney();
  return (
    <section className="border-t border-border">
      <h3 className="flex min-h-12 items-center justify-between px-5 text-sm font-medium sm:px-6">
        <span>{label}</span>
        {total != null && <bdi className="font-normal tabular-nums">{formatCurrency(total)}</bdi>}
      </h3>
      <div className="px-5 sm:px-6">{children}</div>
    </section>
  );
}

function Items({ items }: { items: { id: number; date: string; description: string; amount: number }[] }) {
  const formatCurrency = useMoney();
  const locale = useLocale();
  const day = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  if (items.length === 0) return <p className="pb-3 text-sm text-muted-foreground">—</p>;
  return (
    <ul className="divide-y divide-border pb-1 text-sm">
      {items.map((x) => (
        <li key={x.id} className="flex items-center justify-between gap-3 py-2.5">
          <span className="min-w-0">
            <bdi className="block truncate">{x.description}</bdi>
            <span className="text-xs text-muted-foreground">{day.format(new Date(x.date.slice(0, 10) + "T00:00:00"))}</span>
          </span>
          <bdi className="tabular-nums">{formatCurrency(Math.abs(x.amount))}</bdi>
        </li>
      ))}
    </ul>
  );
}
