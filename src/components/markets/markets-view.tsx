"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { getMarkets } from "@/lib/api";
import { CardShell } from "@/components/home/card-shell";
import { RotateCw } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkline } from "@/components/ui/sparkline";
import { cn } from "@/lib/utils";
import type { MarketsPayload, Quote } from "@/lib/types";

const GROUPS = ["israel", "world", "fx", "commodities"] as const;
const pct = (n: number | null) => (n == null ? "—" : `${n >= 0 ? "+" : "−"}${(Math.abs(n) * 100).toFixed(1)}%`);
const tone = (n: number | null) => (n == null ? "text-muted-foreground" : n >= 0 ? "text-status-on-track" : "text-status-over");

/** Indices and rates are plain numbers; commodities and crypto are priced in dollars. */
function price(q: Quote, group: string, locale: string) {
  const digits = q.price < 20 ? 3 : q.price < 1000 ? 2 : 0;
  const n = q.price.toLocaleString(locale === "he" ? "he-IL" : "en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
  return group === "commodities" && q.currency === "USD" ? `$${n}` : n;
}

export function MarketsView() {
  const t = useTranslations("markets");
  const query = useQuery({ queryKey: ["markets"], queryFn: getMarkets, refetchInterval: 15 * 60 * 1000 });

  if (query.isError) {
    return (
      <CardShell>
        <p className="text-footnote text-muted-foreground">{t("loadFailed")}</p>
        <IconButton label={t("retry")} variant="outline" className="mt-3 self-start" onClick={() => query.refetch()}><RotateCw className="size-4" aria-hidden /></IconButton>
      </CardShell>
    );
  }
  if (!query.data) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
      </div>
    );
  }

  const stale = query.data.items.some((i) => i.quote?.stale);
  return (
    <div className="space-y-6 md:space-y-8">
      {stale && <p className="text-footnote text-status-heads-up" role="status">{t("staleNotice")}</p>}
      {GROUPS.map((g) => (
        <section key={g} aria-labelledby={`mk-${g}`}>
          <h3 id={`mk-${g}`} className="mb-3 px-1 text-headline font-semibold">{t(`group_${g}`)}</h3>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {query.data.items.filter((i) => i.group === g).map((i) => <Tile key={i.symbol} item={i} />)}
          </ul>
        </section>
      ))}
      <p className="px-1 text-caption text-muted-foreground">{t("source")}</p>
    </div>
  );
}

function Tile({ item }: { item: MarketsPayload["items"][number] }) {
  const t = useTranslations("markets");
  const locale = useLocale();
  const q = item.quote;
  const name = t(`symbols.${item.key}`);
  return (
    <li className="rounded-2xl bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-footnote font-semibold">{name}</h3>
          <p className="text-caption text-muted-foreground" dir="ltr">{item.symbol}</p>
        </div>
        <span className={cn("text-footnote font-semibold tabular-nums", tone(q?.changeDay ?? null))} dir="ltr">
          {pct(q?.changeDay ?? null)}
        </span>
      </div>
      {q ? (
        <>
          <div className="mt-3 flex items-end justify-between gap-3">
            <p className="figure text-[1.75rem] leading-tight" dir="ltr">{price(q, item.group, locale)}</p>
            <Sparkline values={q.series} color={(q.change12m ?? 0) >= 0 ? "var(--status-on-track)" : "var(--status-over)"} label={t("trend12m", { name })} fitToRange className="h-9 w-28" />
          </div>
          <dl className="mt-3 flex gap-5 text-caption">
            <div>
              <dt className="text-muted-foreground">{t("ytd")}</dt>
              <dd className={cn("font-semibold tabular-nums", tone(q.changeYtd))} dir="ltr">{pct(q.changeYtd)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("twelveMonths")}</dt>
              <dd className={cn("font-semibold tabular-nums", tone(q.change12m))} dir="ltr">{pct(q.change12m)}</dd>
            </div>
          </dl>
        </>
      ) : (
        <p className="mt-3 text-footnote text-muted-foreground">{t("unavailable")}</p>
      )}
    </li>
  );
}

/** Three key markets in one line for Home. */
export function MarketStrip() {
  const t = useTranslations("markets");
  const locale = useLocale();
  const query = useQuery({ queryKey: ["markets"], queryFn: getMarkets, refetchInterval: 15 * 60 * 1000 });
  const items = query.data?.items.filter((i) => ["ta125", "sp500", "usdils"].includes(i.key) && i.quote) ?? [];
  if (items.length === 0) return null;
  return (
    <Link
      href="/investments#markets"
      aria-label={t("stripLabel")}
      className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl bg-card px-4 py-3 text-footnote transition-colors hover:bg-accent md:mb-8"
    >
      {items.map((i) => (
        <span key={i.key} className="flex items-baseline gap-2">
          <span className="text-muted-foreground">{t(`symbols.${i.key}`)}</span>
          <span className="font-semibold tabular-nums" dir="ltr">{price(i.quote!, i.group, locale)}</span>
          <span className={cn("tabular-nums", tone(i.quote!.changeDay))} dir="ltr">{pct(i.quote!.changeDay)}</span>
        </span>
      ))}
    </Link>
  );
}
