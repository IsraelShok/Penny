"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { getAssets } from "@/lib/api";
import { moneyTree, TREE_STAGES, type MoneyTree } from "@/lib/money-tree";
import { shekels } from "@/lib/money";
import { CardAction, CardShell, CardSkeleton } from "./card-shell";

const GROUND = 244;
const GOLDEN = 2.39996; // golden angle in radians, spreads leaves evenly without randomness

export function MoneyTreeCard() {
  const t = useTranslations("moneyTree");
  const locale = useLocale();
  const { data, isLoading, isError } = useQuery({ queryKey: ["assets"], queryFn: getAssets });

  if (isLoading) return <CardSkeleton label={t("title")} height={260} />;

  const planted = !isError && !!data && data.assets.length > 0;
  const netWorth = planted ? data.totals.netWorth : 0;
  const tree = moneyTree(netWorth, planted ? data.history : []);
  const stageName = t(`stage.${tree.stage}`);
  const nextName = tree.stage < TREE_STAGES.length - 1 ? t(`stage.${tree.stage + 1}`) : null;

  const message = !planted
    ? t("plant")
    : tree.trend === "up"
      ? t("growing", { amount: shekels(tree.change, locale) })
      : tree.trend === "down"
        ? t("autumn")
        : t("steady");

  return (
    <CardShell
      label={t("title")}
      action={<CardAction href="/investments">{planted ? t("water") : t("plantAction")}</CardAction>}
      className="mb-4 md:mb-5 lg:mb-6"
    >
      <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <TreeArt tree={tree} label={t("artLabel", { stage: stageName })} />
        <div className="min-w-0 space-y-3">
          <div>
            <p className="text-footnote text-muted-foreground">{t("netWorth")}</p>
            <p className="text-3xl font-semibold tabular-nums">{shekels(netWorth, locale)}</p>
            <span className="mt-1 inline-block rounded-full bg-emerald-500/12 px-2.5 py-0.5 text-sm font-medium text-emerald-700 dark:text-emerald-300">
              {stageName}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-pretty">{message}</p>
          {planted && nextName && tree.toNext !== null && (
            <div>
              <div
                className="h-2 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(tree.progress * 100)}
                aria-label={t("toNext", { amount: shekels(tree.toNext, locale), stage: nextName })}
              >
                <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-700" style={{ width: `${tree.progress * 100}%` }} />
              </div>
              <p className="mt-1.5 text-footnote text-muted-foreground">
                {t("toNext", { amount: shekels(tree.toNext, locale), stage: nextName })}
              </p>
            </div>
          )}
        </div>
      </div>
    </CardShell>
  );
}

function TreeArt({ tree, label }: { tree: MoneyTree; label: string }) {
  // Size grows within a stage too, so every shekel shows a little.
  const size = tree.stage + tree.progress * 0.9;
  const trunkH = 24 + size * 16;
  const top = GROUND - trunkH;
  const r = 14 + size * 10;
  const leaves = tree.stage === 0 ? 0 : 4 + tree.stage * 4;
  const fruits = tree.stage >= 2 ? tree.stage * 2 - 1 : 0;

  const spot = (i: number, spread: number) => {
    const d = Math.sqrt((i + 0.5) / Math.max(leaves, 1)) * spread;
    // Rounded so server and client render identical attributes (trig differs in the last digit).
    return { x: Math.round(160 + Math.cos(i * GOLDEN) * d * 1.25), y: Math.round(top - r * 0.35 + Math.sin(i * GOLDEN) * d * 0.6) };
  };

  return (
    <svg viewBox={tree.stage === 0 ? "0 150 320 110" : "0 0 320 260"} role="img" aria-label={label} className="mx-auto w-full max-w-[320px]">
      <ellipse cx="160" cy={GROUND + 4} rx="120" ry="12" className="fill-emerald-900/10 dark:fill-emerald-200/10" />
      <g
        className="motion-safe:animate-[treeSway_7s_ease-in-out_infinite]"
        style={{ transformOrigin: `160px ${GROUND}px` }}
      >
        {tree.stage === 0 ? (
          <g transform={`translate(160 ${GROUND}) scale(1.8) translate(-160 -${GROUND})`}>
            <path d={`M160 ${GROUND} Q158 ${GROUND - 14} 160 ${GROUND - 26}`} className="stroke-emerald-700 dark:stroke-emerald-400" strokeWidth="3" fill="none" strokeLinecap="round" />
            <ellipse cx="151" cy={GROUND - 26} rx="9" ry="5" transform={`rotate(-25 151 ${GROUND - 26})`} className="fill-emerald-500 dark:fill-emerald-400" />
            <ellipse cx="169" cy={GROUND - 30} rx="9" ry="5" transform={`rotate(25 169 ${GROUND - 30})`} className="fill-emerald-400 dark:fill-emerald-300" />
          </g>
        ) : (
          <>
            <path
              d={`M${153 - size * 1.5} ${GROUND} Q158 ${top + trunkH * 0.5} 157 ${top + 6} L163 ${top + 6} Q162 ${top + trunkH * 0.5} ${167 + size * 1.5} ${GROUND} Z`}
              className="fill-amber-800 dark:fill-amber-700"
            />
            {Array.from({ length: Math.min(tree.stage, 4) }, (_, i) => {
              const y = top + 10 + i * (trunkH * 0.12);
              const side = i % 2 ? 1 : -1;
              return <path key={i} d={`M160 ${y + 14} Q${160 + side * r * 0.4} ${y + 4} ${160 + side * r * 0.75} ${y - 6}`} className="stroke-amber-800 dark:stroke-amber-700" strokeWidth={2 + size * 0.4} fill="none" strokeLinecap="round" />;
            })}
            {Array.from({ length: leaves }, (_, i) => {
              const p = spot(i, r);
              return (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={r * 0.38}
                  className={i % 3 === 0 ? "fill-emerald-600 dark:fill-emerald-500" : i % 3 === 1 ? "fill-emerald-500 dark:fill-emerald-400" : "fill-green-400 dark:fill-green-300"}
                  opacity={tree.trend === "down" && i % 4 === 0 ? 0.55 : 0.92}
                />
              );
            })}
            {Array.from({ length: fruits }, (_, i) => {
              const p = spot(i * 3 + 1, r * 0.9);
              return (
                <g key={i}>
                  <circle cx={p.x} cy={p.y} r="5.5" className="fill-amber-400 stroke-amber-600" strokeWidth="1.2" />
                  <circle cx={p.x - 1.6} cy={p.y - 1.6} r="1.4" className="fill-amber-100" />
                </g>
              );
            })}
          </>
        )}
      </g>
      {tree.trend === "down" &&
        [0, 1, 2].map((i) => (
          <ellipse
            key={i}
            cx={120 + i * 38}
            cy={top}
            rx="5"
            ry="3"
            className="fill-amber-500/80 motion-safe:animate-[leafFall_6s_ease-in_infinite] motion-reduce:hidden"
            style={{ animationDelay: `${i * 1.8}s` }}
          />
        ))}
      {tree.trend === "up" &&
        [0, 1, 2].map((i) => (
          <circle
            key={i}
            cx={130 + i * 30}
            cy={GROUND - 10}
            r="3.5"
            className="fill-amber-400 motion-safe:animate-[coinRise_5s_ease-out_infinite] motion-reduce:hidden"
            style={{ animationDelay: `${i * 1.5}s` }}
          />
        ))}
    </svg>
  );
}
