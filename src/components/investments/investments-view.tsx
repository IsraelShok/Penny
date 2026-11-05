"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { FileUp, Pencil, Plus, Trash2 } from "lucide-react";
import { deleteAsset, getAssets } from "@/lib/api";
import { CardShell } from "@/components/home/card-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkline } from "@/components/ui/sparkline";
import { cn } from "@/lib/utils";
import { AssetDialog } from "./asset-dialog";
import { ImportDialog } from "./import-dialog";
import type { Asset, AssetsPayload } from "@/lib/types";

const fmt = (n: number, locale: string, digits = 0) =>
  n.toLocaleString(locale === "he" ? "he-IL" : "en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
// LTR isolate keeps the sign in front of the amount inside Hebrew text.
const shekels = (n: number, locale: string) => `⁦${n < 0 ? "−" : ""}₪${fmt(Math.abs(n), locale)}⁩`;
const pct = (n: number) => `${n >= 0 ? "+" : "−"}${(Math.abs(n) * 100).toFixed(1)}%`;

/** Allocation colours: the three brand tones first, then neutral steps. */
const ALLOC_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--muted-foreground)"];

export function InvestmentsView() {
  const t = useTranslations("investments");
  const [editing, setEditing] = useState<Asset | "new" | null>(null);
  const [importing, setImporting] = useState(false);
  const query = useQuery({ queryKey: ["assets"], queryFn: getAssets });

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={() => setImporting(true)}>
          <FileUp className="size-4" aria-hidden />
          {t("importCsv")}
        </Button>
        <Button onClick={() => setEditing("new")}>
          <Plus className="size-4" aria-hidden />
          {t("addAsset")}
        </Button>
      </div>

      {query.isError ? (
        <CardShell>
          <p className="text-footnote text-muted-foreground">{t("loadFailed")}</p>
          <Button variant="outline" className="mt-3 self-start" onClick={() => query.refetch()}>{t("retry")}</Button>
        </CardShell>
      ) : !query.data ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-40 rounded-2xl md:col-span-2" />
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl md:col-span-3" />
        </div>
      ) : query.data.assets.length === 0 ? (
        <CardShell>
          <div className="mx-auto max-w-md py-8 text-center">
            <h2 className="text-title font-semibold">{t("emptyTitle")}</h2>
            <p className="mt-2 text-footnote text-pretty text-muted-foreground">{t("emptyBody")}</p>
            <div className="mt-5 flex justify-center gap-2">
              <Button onClick={() => setEditing("new")}>{t("addAsset")}</Button>
              <Button variant="outline" onClick={() => setImporting(true)}>{t("importCsv")}</Button>
            </div>
          </div>
        </CardShell>
      ) : (
        <Body data={query.data} onEdit={setEditing} />
      )}

      {editing && <AssetDialog asset={editing} onClose={() => setEditing(null)} />}
      {importing && <ImportDialog onClose={() => setImporting(false)} />}
    </div>
  );
}

function Body({ data, onEdit }: { data: AssetsPayload; onEdit: (a: Asset) => void }) {
  const t = useTranslations("investments");
  const locale = useLocale();
  const { totals } = data;
  const first = data.history[0];
  const change = first && data.history.length > 1 ? totals.netWorth - first.netWorth : null;
  const owned = data.assets.filter((a) => !a.isLiability);
  const owed = data.assets.filter((a) => a.isLiability);
  const missing = data.assets.filter((a) => a.valueIls == null);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <CardShell label={t("netWorth")} className="md:col-span-2">
          <p className="text-display font-semibold tabular-nums text-gold">{shekels(totals.netWorth, locale)}</p>
          {change != null && (
            <p className="mt-1 text-footnote text-muted-foreground">
              <span className={cn("font-semibold tabular-nums", change >= 0 ? "text-status-on-track" : "text-status-over")}>
                {shekels(change, locale)}
              </span>{" "}
              {t("sinceFirst", { date: new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${first.date}T12:00:00`)) })}
            </p>
          )}
          {data.history.length > 1 && (
            <Sparkline values={data.history.map((h) => h.netWorth)} color="var(--gold)" label={t("netWorthTrend")} fitToRange className="mt-4 h-16 w-full" />
          )}
          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-footnote sm:grid-cols-4">
            <Figure label={t("totalAssets")} value={shekels(totals.assets, locale)} />
            <Figure label={t("totalLiabilities")} value={shekels(-totals.liabilities, locale)} />
            <Figure label={t("deferredTax")} value={shekels(-totals.deferredTax, locale)} hint={t("deferredTaxHint")} />
            <Figure label={t("liquidNetWorth")} value={shekels(totals.liquidNetWorth, locale)} hint={t("liquidNetWorthHint")} />
          </dl>
        </CardShell>

        <Benchmarks data={data} />
      </div>

      {missing.length > 0 && (
        <p className="rounded-xl border border-border bg-card px-4 py-3 text-footnote text-status-heads-up" role="status">
          {t("missingPrices", { names: missing.map((a) => a.name).join(", ") })}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Allocation title={t("byType")} parts={groupBy(owned, (a) => t(`type_${a.type}`))} />
        <Allocation title={t("byCurrency")} parts={groupBy(owned, (a) => a.currency)} />
      </div>

      <HoldingsList title={t("assetsTitle")} assets={owned} onEdit={onEdit} />
      {owed.length > 0 && <HoldingsList title={t("liabilitiesTitle")} assets={owed} onEdit={onEdit} />}
    </>
  );
}

function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div title={hint}>
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function groupBy(assets: Asset[], key: (a: Asset) => string) {
  const map = new Map<string, number>();
  for (const a of assets) map.set(key(a), (map.get(key(a)) ?? 0) + (a.valueIls ?? 0));
  return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

function Allocation({ title, parts }: { title: string; parts: { label: string; value: number }[] }) {
  const locale = useLocale();
  const total = parts.reduce((s, p) => s + p.value, 0);
  // Fold the tail into "other" so colours stay distinct.
  const shown = parts.length > ALLOC_COLORS.length ? [...parts.slice(0, ALLOC_COLORS.length - 1), { label: "…", value: parts.slice(ALLOC_COLORS.length - 1).reduce((s, p) => s + p.value, 0) }] : parts;
  return (
    <CardShell label={title}>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
        {shown.map((p, i) => <span key={p.label} style={{ width: `${total ? (p.value / total) * 100 : 0}%`, backgroundColor: ALLOC_COLORS[i] }} />)}
      </div>
      <ul className="mt-4 space-y-2">
        {shown.map((p, i) => (
          <li key={p.label} className="flex items-baseline justify-between gap-3 text-footnote">
            <span className="flex min-w-0 items-center gap-2">
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: ALLOC_COLORS[i] }} aria-hidden />
              <span className="truncate">{p.label}</span>
            </span>
            <span className="shrink-0 tabular-nums">
              <span className="font-semibold">{total ? `${Math.round((p.value / total) * 100)}%` : "—"}</span>
              <span className="ms-2 text-muted-foreground">{shekels(p.value, locale)}</span>
            </span>
          </li>
        ))}
      </ul>
    </CardShell>
  );
}

function Benchmarks({ data }: { data: AssetsPayload }) {
  const t = useTranslations("investments");
  const tm = useTranslations("markets.symbols");
  const withCost = data.assets.filter((a) => !a.isLiability && a.gainIls != null && a.valueIls != null);
  const cost = withCost.reduce((s, a) => s + (a.valueIls! - a.gainIls!), 0);
  const gain = withCost.reduce((s, a) => s + a.gainIls!, 0);
  const rows = [
    { label: t("yourReturn"), value: cost > 0 ? gain / cost : null, note: t("yourReturnNote") },
    ...data.benchmarks.map((b) => ({ label: tm(b.symbol === "^GSPC" ? "sp500" : "ta125"), value: b.change12m, note: t("last12m") })),
  ];
  return (
    <CardShell label={t("vsMarket")}>
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.label} className="flex items-baseline justify-between gap-3">
            <span className="min-w-0">
              <span className="block text-footnote font-medium">{r.label}</span>
              <span className="text-caption text-muted-foreground">{r.note}</span>
            </span>
            <span dir="ltr" className={cn("text-headline font-semibold tabular-nums", r.value == null ? "text-muted-foreground" : r.value >= 0 ? "text-status-on-track" : "text-status-over")}>
              {r.value == null ? "—" : pct(r.value)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-caption text-pretty text-muted-foreground">{t("vsMarketHint")}</p>
    </CardShell>
  );
}

function HoldingsList({ title, assets, onEdit }: { title: string; assets: Asset[]; onEdit: (a: Asset) => void }) {
  const t = useTranslations("investments");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: (id: number) => deleteAsset(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      toast.success(t("deleted"));
    },
    onError: () => toast.error(t("deleteFailed")),
  });

  return (
    <CardShell label={title}>
      <ul className="divide-y divide-border">
        {assets.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
            <div className="min-w-0 flex-1 basis-40">
              <p className="truncate text-footnote font-medium">{a.name}</p>
              <p className="truncate text-caption text-muted-foreground">
                {t(`type_${a.type}`)}
                {a.symbol && a.quantity != null && (
                  <> · <span dir="ltr">{fmt(a.quantity, locale, a.quantity % 1 ? 2 : 0)} × {a.symbol}</span></>
                )}
                {!a.liquid && !a.isLiability && <> · {t("illiquid")}</>}
                {a.quote?.stale && <> · {t("stalePrice")}</>}
              </p>
            </div>
            {a.quote && a.quote.series.length > 1 && (
              <Sparkline values={a.quote.series} color="var(--chart-1)" label={t("priceTrend", { name: a.name })} fitToRange className="hidden h-7 w-20 sm:block" />
            )}
            <div className="text-end">
              <p className={cn("text-footnote font-semibold tabular-nums", a.isLiability && "text-status-over")}>
                {a.valueIls == null ? "—" : shekels(a.isLiability ? -a.valueIls : a.valueIls, locale)}
              </p>
              <p className="text-caption tabular-nums text-muted-foreground" dir="ltr">
                {a.quote?.changeDay != null && (
                  <span className={a.quote.changeDay >= 0 ? "text-status-on-track" : "text-status-over"}>{pct(a.quote.changeDay)} </span>
                )}
                {a.gainIls != null && <span>{shekels(a.gainIls, locale)}</span>}
              </p>
            </div>
            <div className="flex shrink-0">
              <Button variant="ghost" size="icon" aria-label={t("editAsset", { name: a.name })} onClick={() => onEdit(a)}>
                <Pencil className="size-4" aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("deleteAsset", { name: a.name })}
                disabled={remove.isPending}
                onClick={() => {
                  if (window.confirm(t("confirmDelete", { name: a.name }))) remove.mutate(a.id);
                }}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </CardShell>
  );
}
