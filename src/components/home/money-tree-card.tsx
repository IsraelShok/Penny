"use client";

import { useId } from "react";
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
  // Unique gradient ids per instance; colons are not valid in url(#…) references.
  const id = useId().replace(/:/g, "");
  const g = (name: string) => `url(#${name}-${id})`;
  // Size grows within a stage too, so every shekel shows a little.
  const size = tree.stage + tree.progress * 0.9;
  const trunkH = 30 + size * 16;
  const top = GROUND - trunkH;
  const r = 16 + size * 10;
  const cy = top - r * 0.3;
  const clusters = tree.stage === 0 ? 0 : 5 + tree.stage * 3;
  const coins = tree.stage === 0 ? 0 : tree.stage * 2;
  const notes = tree.stage >= 2 ? tree.stage - 1 : 0;
  const trunkW = 5 + size * 1.6;

  const spot = (i: number, n: number, spread: number) => {
    const d = Math.sqrt((i + 0.5) / Math.max(n, 1)) * spread;
    // Rounded so server and client render identical attributes (trig differs in the last digit).
    return { x: Math.round(160 + Math.cos(i * GOLDEN) * d * 1.25), y: Math.round(cy + Math.sin(i * GOLDEN) * d * 0.62) };
  };

  return (
    <svg viewBox={tree.stage === 0 ? "0 150 320 110" : "0 0 320 260"} role="img" aria-label={label} className="mx-auto w-full max-w-[320px] overflow-visible">
      <defs>
        <linearGradient id={`bark-${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="#6b3f22" />
          <stop offset="0.45" stopColor="#a8703f" />
          <stop offset="1" stopColor="#5a3319" />
        </linearGradient>
        <radialGradient id={`leaf-${id}`} cx="0.35" cy="0.3" r="0.75">
          <stop offset="0" stopColor="#8ef0a7" />
          <stop offset="0.55" stopColor="#34c759" />
          <stop offset="1" stopColor="#1e8e44" />
        </radialGradient>
        <radialGradient id={`leafBack-${id}`} cx="0.4" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#3fbf68" />
          <stop offset="1" stopColor="#146b35" />
        </radialGradient>
        <radialGradient id={`coin-${id}`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#fff6c2" />
          <stop offset="0.5" stopColor="#ffcc00" />
          <stop offset="1" stopColor="#c48a00" />
        </radialGradient>
        <linearGradient id={`note-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fffdf0" />
          <stop offset="1" stopColor="#ffe08a" />
        </linearGradient>
        <radialGradient id={`ground-${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#1e8e44" stopOpacity="0.28" />
          <stop offset="1" stopColor="#1e8e44" stopOpacity="0" />
        </radialGradient>
        <filter id={`soft-${id}`} x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#0b3d1c" floodOpacity="0.22" />
        </filter>
      </defs>

      <ellipse cx="160" cy={GROUND + 2} rx={70 + size * 8} ry="12" fill={g("ground")} />

      <g className="motion-safe:animate-[treeSway_7s_ease-in-out_infinite]" style={{ transformOrigin: `160px ${GROUND}px` }}>
        {tree.stage === 0 ? (
          // A coin planted in the soil, with the first shoot growing out of it.
          <g transform={`translate(160 ${GROUND}) scale(1.6) translate(-160 -${GROUND})`}>
            <path d={`M160 ${GROUND - 6} C158 ${GROUND - 16} 162 ${GROUND - 22} 160 ${GROUND - 32}`} stroke="#1e8e44" strokeWidth="2.6" fill="none" strokeLinecap="round" />
            <path d={`M160 ${GROUND - 28} C150 ${GROUND - 38} 141 ${GROUND - 32} 142 ${GROUND - 26} C148 ${GROUND - 22} 156 ${GROUND - 24} 160 ${GROUND - 28} Z`} fill={g("leaf")} />
            <path d={`M160 ${GROUND - 31} C170 ${GROUND - 43} 180 ${GROUND - 38} 179 ${GROUND - 31} C172 ${GROUND - 26} 164 ${GROUND - 27} 160 ${GROUND - 31} Z`} fill={g("leaf")} />
            <Coin x={160} y={GROUND - 3} r={7} fill={g("coin")} />
          </g>
        ) : (
          <>
            <path
              d={`M${160 - trunkW - 6} ${GROUND} Q${160 - trunkW} ${GROUND - 6} ${160 - trunkW * 0.7} ${GROUND - trunkH * 0.35} Q${160 - trunkW * 0.45} ${top + 8} 157 ${top} L163 ${top} Q${160 + trunkW * 0.45} ${top + 8} ${160 + trunkW * 0.7} ${GROUND - trunkH * 0.35} Q${160 + trunkW} ${GROUND - 6} ${160 + trunkW + 6} ${GROUND} Z`}
              fill={g("bark")}
            />
            {Array.from({ length: Math.min(tree.stage + 1, 5) }, (_, i) => {
              const y = Math.round(top + 6 + i * trunkH * 0.1);
              const side = i % 2 ? 1 : -1;
              return <path key={i} d={`M160 ${y + 16} Q${160 + side * r * 0.35} ${y + 4} ${Math.round(160 + side * r * 0.8)} ${y - 8}`} stroke={g("bark")} strokeWidth={Math.max(2, trunkW * 0.45)} fill="none" strokeLinecap="round" />;
            })}
            <g filter={g("soft")}>
              {Array.from({ length: clusters }, (_, i) => {
                const p = spot(i, clusters, r * 1.05);
                return <circle key={`b${i}`} cx={p.x} cy={p.y - 4} r={Math.round(r * 0.46)} fill={g("leafBack")} />;
              })}
              {Array.from({ length: clusters }, (_, i) => {
                const p = spot(i + 2, clusters + 2, r * 0.9);
                return (
                  <circle
                    key={`f${i}`}
                    cx={p.x}
                    cy={p.y + 2}
                    r={Math.round(r * 0.38)}
                    fill={g("leaf")}
                    opacity={tree.trend === "down" && i % 4 === 0 ? 0.6 : 1}
                  />
                );
              })}
            </g>
            {/* Glassy highlight, as on iOS icons. */}
            <ellipse cx={Math.round(160 - r * 0.45)} cy={Math.round(cy - r * 0.45)} rx={Math.round(r * 0.5)} ry={Math.round(r * 0.22)} fill="#ffffff" opacity="0.22" transform={`rotate(-18 ${Math.round(160 - r * 0.45)} ${Math.round(cy - r * 0.45)})`} />
            {Array.from({ length: notes }, (_, i) => {
              const p = spot(i * 5 + 3, clusters, r * 0.95);
              return <Note key={`n${i}`} x={p.x} y={p.y + 6} rot={i % 2 ? 14 : -12} fill={g("note")} />;
            })}
            {Array.from({ length: coins }, (_, i) => {
              const p = spot(i * 3 + 1, clusters, r * 0.92);
              return <Coin key={`c${i}`} x={p.x} y={p.y + 8} r={Math.round(7 + size * 0.5)} fill={g("coin")} hanging />;
            })}
          </>
        )}
      </g>

      {tree.trend === "down" &&
        [0, 1, 2].map((i) => (
          <ellipse
            key={i}
            cx={122 + i * 38}
            cy={top}
            rx="5"
            ry="3"
            fill="#e0a43a"
            className="motion-safe:animate-[leafFall_6s_ease-in_infinite] motion-reduce:hidden"
            style={{ animationDelay: `${i * 1.8}s` }}
          />
        ))}
      {tree.trend === "up" &&
        [0, 1, 2].map((i) => (
          <g key={i} className="motion-safe:animate-[coinRise_5s_ease-out_infinite] motion-reduce:hidden" style={{ animationDelay: `${i * 1.5}s` }}>
            <Coin x={128 + i * 32} y={GROUND - 8} r={5} fill={g("coin")} />
          </g>
        ))}
    </svg>
  );
}

/** A gold shekel coin with a shine; `hanging` adds the little stem it grows from. */
function Coin({ x, y, r, fill, hanging }: { x: number; y: number; r: number; fill: string; hanging?: boolean }) {
  return (
    <g>
      {hanging && <line x1={x} y1={y - r - 5} x2={x} y2={y - r + 1} stroke="#1e8e44" strokeWidth="1.2" strokeLinecap="round" />}
      <circle cx={x} cy={y} r={r} fill={fill} stroke="#b07b00" strokeWidth="0.8" />
      <circle cx={x} cy={y} r={r * 0.72} fill="none" stroke="#fff3b0" strokeWidth="0.6" opacity="0.7" />
      <text x={x} y={y + r * 0.38} textAnchor="middle" fontSize={r * 1.05} fontWeight="700" fill="#8a5a00">₪</text>
    </g>
  );
}

/** A small banknote hanging like a leaf. */
function Note({ x, y, rot, fill }: { x: number; y: number; rot: number; fill: string }) {
  return (
    <g transform={`rotate(${rot} ${x} ${y})`}>
      <line x1={x} y1={y - 9} x2={x} y2={y - 5} stroke="#1e8e44" strokeWidth="1.2" strokeLinecap="round" />
      <rect x={x - 11} y={y - 5} width="22" height="13" rx="2.5" fill={fill} stroke="#c99a1e" strokeWidth="0.8" />
      <circle cx={x} cy={y + 1.5} r="3.6" fill="none" stroke="#a26f00" strokeWidth="0.7" />
      <text x={x} y={y + 3.4} textAnchor="middle" fontSize="5.4" fontWeight="700" fill="#a26f00">₪</text>
    </g>
  );
}
