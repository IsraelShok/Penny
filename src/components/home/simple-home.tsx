"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, Plus, AlertCircle, Menu, MoreVertical, Landmark, CalendarDays, Tags, ArrowLeftRight, PiggyBank, Settings, SlidersHorizontal } from "lucide-react";
import { Back, Forward } from "@/components/ui/dir-chevron";
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
import { buildCashflow, cashflowMonth } from "@/lib/simple-cashflow";
import { allocate, liquidCash } from "@/lib/allocation";

/**
 * Simple mode: one scrolling page, one card per cash-flow line, newest month first.
 * Order: month bar, end-of-month forecast, variable spending by week, each tracked category,
 * savings deposits, fixed costs, total, income (with savings growth), off-cash-flow.
 */
/** `cardOnly`: just this month's forecast card (rings included), for Advanced mode's Home. */
export function SimpleHome({ name, cardOnly, extra }: { name?: string | null; cardOnly?: boolean; /** Shown under the bank balance (Advanced mode puts its next step here). */ extra?: React.ReactNode }) {
  const formatCurrency = useMoney();
  const t = useTranslations("home.simple");
  const locale = useLocale();
  const [offset, setOffset] = useState(0);
  const [justTracked, setJustTracked] = useState<number[]>([]);
  const goMonth = (o: number) => { setOffset(o); setJustTracked([]); };
  // Desktop: which line the detail panel shows.
  const [selected, setSelected] = useState("variable");

  const queryClient = useQueryClient();
  const tCat = useTranslations("categoriesSeeded");
  const catName = (n: string) => translateCategoryName(n, tCat);
  // One month start for the whole app: the plan's, which the overview API also uses.
  const { plan, loaded: planLoaded, failed: planFailed } = usePlan();
  const { from: first, to: last } = cashflowMonth(plan.monthStartDay, offset);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  // Named after the month most of the range falls in.
  const monthName = new Date(first.getFullYear(), first.getMonth(), first.getDate() + 14).toLocaleDateString(locale, { month: "long", year: "numeric" });

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
  const untracked = (cats.data ?? []).filter((c) => c.kind === "expense" && c.budgetMode !== "budgeted" && c.costType !== "fixed" && c.needType !== "saving" && !parentIds.has(c.id));
  const groups = assets.data ? wealthGroups(assets.data.assets) : null;
  const wealth = groups ? (Object.keys(groups) as WealthGroup[]).filter((g) => groups[g].value > 0) : [];

  return (
    <div className={cardOnly ? "" : "mx-auto max-w-md lg:max-w-6xl"}>
      {/* Month bar */}
      {!cardOnly && <nav className="sticky top-0 z-10 mb-4 flex items-center gap-1 rounded-2xl border border-border/60 bg-card px-2 py-1.5 lg:static lg:mx-auto lg:mb-3 lg:max-w-md" aria-label={t("monthNav")}>
        <SimpleMenu name={name} run={run} />
        <button type="button" className="grid size-11 place-items-center rounded-full hover:bg-accent" onClick={() => goMonth(offset + 1)} aria-label={t("prevMonth")}>
          <Back className="size-5" />
        </button>
        <span className="flex-1 text-center text-headline font-semibold">{monthName}</span>
        <button type="button" className="grid size-11 place-items-center rounded-full hover:bg-accent disabled:opacity-30" disabled={offset === 0} onClick={() => goMonth(offset - 1)} aria-label={t("nextMonth")}>
          <Forward className="size-5" />
        </button>
      </nav>}

      {failed ? (
        <Card>
          <div role="alert" className="flex flex-col items-start gap-3 p-5 sm:p-6">
            <p className="text-headline font-semibold">{t("loadFailed")}</p>
            <button type="button" onClick={retry} className="min-h-11 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground">{t("tryAgain")}</button>
          </div>
        </Card>
      ) : !cf ? (
        <div role="status" className="wallet h-64 animate-pulse rounded-3xl"><span className="sr-only">{t("loading")}</span></div>
      ) : (() => {
        const growthTotal = wealth.reduce((sum, g) => sum + groups![g].growth, 0);
        const weeksTable = (
          <table className="w-full text-sm">
            <thead><tr className="text-muted-foreground"><th className="py-2 text-start font-normal" /><th className="text-start font-normal">{t("weekBudget")}</th><th className="text-start font-normal">{t("spent")}</th><th className="text-start font-normal">{t("leftToSpend")}</th></tr></thead>
            <tbody>
              {cf.weeks.map((w, i) => (
                <tr key={i} className={`border-t border-border ${w.future ? "text-muted-foreground" : ""}`}>
                  <td className="py-2.5">{t("week", { n: i + 1 })}</td>
                  <td className="tabular-nums text-muted-foreground"><bdi>{formatCurrency(w.share)}</bdi></td>
                  <td className="tabular-nums"><bdi>{formatCurrency(w.spent)}</bdi></td>
                  <td className="tabular-nums"><bdi>{formatCurrency(w.left)}</bdi></td>
                </tr>
              ))}
            </tbody>
          </table>
        );
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
        const tracked: LineView[] = cf.tracked
          .filter((c) => c.expected > 0 || c.spent > 0 || justTracked.includes(c.id))
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
            sections: c.items.length ? [{ label: t("details"), content: <Items items={c.items} /> }] : [],
          }));
        const variableLine: LineView = {
          key: "variable", title: t("variable"), tone: "var(--chart-1)", spent: cf.variable.spent, expected: cf.variable.expected,
          spentLabel: t("spent"), expectedLabel: t("recommended"), sections: [{ label: t("byWeek"), content: weeksTable }],
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

        const rings = [
          { label: t("income"), value: cf.income.received, goal: cf.income.expected, color: RING.income },
          { label: t("spendingRing"), value: cf.totalSpent, goal: cf.totalExpected, color: RING.spending },
          { label: t("savingsDeposits"), value: cf.savings.spent, goal: cf.savings.expected, color: RING.savings },
        ];
        const growth = offset === 0 && wealth.length > 0 ? { label: t("wealthGrowth"), value: growthTotal } : null;
        // Same order as the allocation card: one-month buffer, then emergency fund, then the market.
        const alloc = offset === 0 && assets.data ? allocate({ income: Math.max(cf.income.received, cf.income.expected), expenses: cf.totalExpected, liquidNow: liquidCash(assets.data.assets) }) : null;
        const investLine = alloc && alloc.surplus > 0 && (
          <Link href="/investments" className="-my-3 block py-3 font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring">
            {alloc.monthly.market > 0
              ? t("freeToInvest", { amount: formatCurrency(alloc.monthly.market) })
              : t("safetyFirst", { amount: formatCurrency(alloc.surplus) })}
          </Link>
        );
        const hero = (
          <section className="wallet flex flex-col overflow-hidden rounded-3xl border border-white/10 shadow-sm">
            <div className="p-6">
              <div className="flex items-baseline justify-between gap-3 text-footnote text-muted-foreground">
                <span className="truncate">{name && !cardOnly ? t("hi", { name }) : null}</span>
                <SyncLine run={run} />
              </div>
              <h2 className="mt-3 text-lg font-medium text-pretty lg:mt-2 lg:text-base">{t(offset === 0 ? "forecastTitle" : "endedTitle", { month: monthName })}</h2>
              {cf.forecast < 0 && <p className="mt-2 flex items-center gap-1 text-footnote font-medium text-status-heads-up"><AlertCircle className="size-4 shrink-0" aria-hidden />{t("forecastShort")}</p>}
              <p className={`mt-1 text-5xl font-medium tracking-tight tabular-nums lg:text-4xl ${cf.forecast < 0 ? "text-status-heads-up" : ""}`}>
                <Signed n={cf.forecast} />
              </p>
              {offset === 0 && <BalancePill bank={cash.data?.bank ?? null} accounts={cash.data?.accounts ?? []} />}
              {extra}
              <MonthRings rings={rings} growth={growth} />
            </div>
            <div className="space-y-2 border-t border-white/10 px-6 py-4 text-sm leading-relaxed lg:px-5 lg:py-3">
              <p className="text-pretty">
                {t.rich("totalLine", {
                  spent: formatCurrency(cf.totalSpent),
                  expected: formatCurrency(cf.totalExpected),
                  b: (x) => <bdi className="font-semibold tabular-nums">{x}</bdi>,
                })}
              </p>
              {offset === 0 && (
                <p className={`font-medium ${cf.variable.left > 0 ? "" : "text-status-heads-up"}`}>
                  {t("variableLeft", { amount: formatCurrency(Math.max(0, cf.variable.left)) })} · <span className="font-normal text-muted-foreground">{t("untilMonthEnd")}</span>
                </p>
              )}
              {investLine}
            </div>
          </section>
        );
        const trackButton = (
          <DropdownMenu>
            <DropdownMenuTrigger className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/40 px-4 text-sm font-medium text-primary hover:bg-accent disabled:opacity-50 max-lg:min-h-14" disabled={untracked.length === 0}>
              {untracked.length === 0 ? t("allTracked") : <><Plus className="size-4" aria-hidden /> {t("trackCategory")}</>}
            </DropdownMenuTrigger>
            <DropdownMenuContent className="max-h-80 overflow-y-auto">
              {untracked.map((c) => (
                <DropdownMenuItem key={c.id} onClick={() => { setJustTracked((j) => [...j, c.id]); setSelected(`cat-${c.id}`); void act(updateCategoryBudgetMode(c.id, "budgeted")).catch(() => {}); }}>{catName(c.name)}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        );
        const panel = (l: LineView, open = false) => (
          <>
            <Head title={l.title}>{l.menu}</Head>
            {!l.noMeter && <Meter title={l.title} spent={l.spent} expected={l.expected} spentLabel={l.spentLabel} expectedLabel={l.expectedLabel} tone={l.tone} showLeft={l.showLeft} />}
            {l.noMeter && <div className="h-3" />}
            {l.sections.map((s) => <Expand key={s.label} label={s.label} total={s.total} open={open}>{s.content}</Expand>)}
          </>
        );
        const card = (l: LineView) => <Card key={l.key}>{panel(l)}</Card>;

        const strip = (
              <section className="wallet grid shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1.2fr)] items-center gap-6 xl:grid-cols-[minmax(14rem,1fr)_auto_minmax(16rem,1.2fr)_minmax(14rem,1fr)] rounded-2xl border border-white/10 px-6 py-4">
                <div className="min-w-0">
                  <div className="flex items-baseline justify-between gap-3 text-footnote text-muted-foreground">
                <span className="truncate">{name && !cardOnly ? t("hi", { name }) : null}</span>
                    <SyncLine run={run} />
                  </div>
                  <h2 className="mt-1.5 text-base font-medium text-pretty">{t(offset === 0 ? "forecastTitle" : "endedTitle", { month: monthName })}</h2>
                  {cf.forecast < 0 && <p className="mt-1 flex items-center gap-1 text-footnote font-medium text-status-heads-up"><AlertCircle className="size-4 shrink-0" aria-hidden />{t("forecastShort")}</p>}
                  <p className={`mt-0.5 text-4xl font-medium tracking-tight tabular-nums ${cf.forecast < 0 ? "text-status-heads-up" : ""}`}><Signed n={cf.forecast} /></p>
                  {offset === 0 && <BalancePill bank={cash.data?.bank ?? null} accounts={cash.data?.accounts ?? []} />}
              {extra}
                </div>
                <MonthRings rings={rings} growth={growth} part="rings" />
                <MonthRings rings={rings} growth={growth} part="legend" />
                <div className="col-span-full min-w-0 space-y-2 border-t border-white/10 pt-3 text-sm leading-relaxed xl:col-span-1 xl:border-s xl:border-t-0 xl:ps-6 xl:pt-0">
                  <p className="text-pretty">
                    {t.rich("totalLine", {
                      spent: formatCurrency(cf.totalSpent),
                      expected: formatCurrency(cf.totalExpected),
                      b: (x) => <bdi className="font-semibold tabular-nums">{x}</bdi>,
                    })}
                  </p>
                  {offset === 0 && (
                    <p className={`font-medium ${cf.variable.left > 0 ? "" : "text-status-heads-up"}`}>
                      {t("variableLeft", { amount: formatCurrency(Math.max(0, cf.variable.left)) })} · <span className="font-normal text-muted-foreground">{t("untilMonthEnd")}</span>
                    </p>
                  )}
                  {investLine}
                </div>
              </section>
        );

        // Advanced mode borrows just the forecast card: stacked on phones, the wide strip on desktop.
        if (cardOnly) return <div className="mb-6 md:mb-8"><div className="lg:hidden">{hero}</div><div className="hidden lg:block">{strip}</div></div>;

        return (
          <>
            {/* Phone and tablet: one scrolling column. */}
            <div className="space-y-3 lg:hidden">
              {hero}
              {[variableLine, ...tracked].map((l) => card(l))}
              {trackButton}
              {[savingsLine, fixedLine, incomeLine, offLine].map((l) => card(l))}
            </div>

            {/* Desktop, one screen, top to bottom: the forecast as one wide strip (words, rings, legend, summary),
                the chart across the full width so every column fits one row, then the picked line's detail. */}
            <div className="hidden lg:flex lg:h-[calc(100dvh-12.5rem)] lg:min-h-[34rem] lg:flex-col lg:gap-3">
              {strip}
              <Card>
                <div className="px-3 pt-3">
                  <div className="flex items-center justify-between gap-4 px-2">
                    <h2 className="text-headline font-semibold">{t("linesTitle")}</h2>
                    <div className="w-60 shrink-0">{trackButton}</div>
                  </div>
                  <LinesChart lines={lines} selected={current.key} onSelect={setSelected} label={t("linesTitle")} />
                </div>
              </Card>
              <section aria-live="polite" className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card">
                <div key={current.key} className="min-h-0 flex-1 overflow-y-auto pb-2">{panel(current, true)}</div>
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

/** Bank balance, with the accounts behind it, without leaving Simple mode. */
function BalancePill({ bank, accounts }: { bank: number | null; accounts: { provider: string; accountNumber: string; balance: number; updatedAt: string }[] }) {
  const t = useTranslations("home.simple");
  const formatCurrency = useMoney();
  return (
    <Popover>
      <PopoverTrigger className="mt-5 inline-flex min-h-11 items-center gap-1.5 rounded-full glass-tile px-4 text-sm font-medium hover:bg-white/25 lg:mt-4">
        {t("bankBalance")}
        <span className="font-semibold tabular-nums">{bank != null ? <Signed n={bank} /> : "—"}</span>
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

/** Three concentric progress rings (outer first), centered, with the "value / goal" legend underneath. */
function MonthRings({ rings, growth, part }: {
  rings: { label: string; value: number; goal: number; color: string }[];
  growth: { label: string; value: number } | null;
  part?: "rings" | "legend";
}) {
  const formatCurrency = useMoney();
  const size = 132, stroke = 13, gap = 3;
  return (
    <div className={part ? "min-w-0" : "mt-5 flex flex-col items-center gap-5"}>
      {part !== "legend" && <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90 lg:w-28" aria-hidden>
        {rings.map((r, i) => {
          const radius = size / 2 - stroke / 2 - i * (stroke + gap);
          const c = 2 * Math.PI * radius;
          const pct = r.goal > 0 ? Math.min(1, r.value / r.goal) : 0;
          return (
            <g key={r.label}>
              <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={r.color} strokeOpacity={0.22} strokeWidth={stroke} />
              <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={r.color} strokeWidth={stroke} strokeLinecap="round"
                strokeDasharray={`${pct * c} ${c}`} className="transition-[stroke-dasharray] duration-700" />
            </g>
          );
        })}
      </svg>}
      {part !== "rings" && <dl className={part ? "grid grid-cols-2 gap-x-5 gap-y-2" : "w-full space-y-3"}>
        {rings.map((r) => (
          <div key={r.label}>
            <dt className="flex items-center gap-1.5 text-footnote text-muted-foreground">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: r.color }} aria-hidden />{r.label}
            </dt>
            {/* Value and goal wrap as one unit each, so a narrow column never pushes text into the card's edge. */}
            <dd className="flex flex-wrap items-baseline gap-x-1 text-lg font-semibold tabular-nums">
              <bdi>{formatCurrency(r.value)}</bdi>
              {r.goal > 0 && <span className="whitespace-nowrap text-sm font-normal text-muted-foreground">/ <bdi>{formatCurrency(r.goal)}</bdi></span>}
            </dd>
          </div>
        ))}
        {growth && (
          <div>
            <dt className="text-footnote text-muted-foreground">{growth.label}</dt>
            <dd className="text-lg font-semibold tabular-nums"><Signed n={growth.value} /></dd>
          </div>
        )}
      </dl>}
    </div>
  );
}

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
      <h2 className="text-headline font-semibold">{title}</h2>
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
        <bdi className="font-semibold" style={{ color: tone }}>{formatCurrency(spent)}</bdi>
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

function Expand({ label, total, open, children }: { label: string; total?: number; open?: boolean; children: React.ReactNode }) {
  const formatCurrency = useMoney();
  return (
    <details className="group border-t border-border" open={open}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-5 text-sm font-medium hover:bg-accent/50 sm:px-6">
        <span>{label}</span>
        <span className="flex items-center gap-2 font-normal tabular-nums">
          {total != null && <bdi>{formatCurrency(total)}</bdi>}
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden />
        </span>
      </summary>
      <div className="px-5 sm:px-6">{children}</div>
    </details>
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
