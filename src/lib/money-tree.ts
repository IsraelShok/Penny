/** Net worth (₪) at which each tree stage begins: seed, sprout, sapling, young, blossoming, fruiting, ancient. */
export const TREE_STAGES = [0, 10_000, 50_000, 150_000, 400_000, 1_000_000, 2_500_000] as const;

export type TreeTrend = "up" | "flat" | "down";

export interface MoneyTree {
  /** 0 (seed) to 6 (ancient). */
  stage: number;
  /** 0–1 progress toward the next stage; 1 at the last stage. */
  progress: number;
  /** ₪ still missing to reach the next stage, or null at the last stage. */
  toNext: number | null;
  trend: TreeTrend;
  /** Change over roughly the last 30 days, 0 without enough history. */
  change: number;
}

const DAY = 86_400_000;

export function moneyTree(netWorth: number, history: { date: string; netWorth: number }[]): MoneyTree {
  let stage = 0;
  for (let i = TREE_STAGES.length - 1; i > 0; i--) {
    if (netWorth >= TREE_STAGES[i]) { stage = i; break; }
  }
  const next = TREE_STAGES[stage + 1];
  const from = TREE_STAGES[stage];
  const progress = next === undefined ? 1 : Math.min(1, Math.max(0, (netWorth - from) / (next - from)));
  const toNext = next === undefined ? null : Math.max(0, next - netWorth);

  // Latest point at least 30 days before the newest one.
  let change = 0;
  if (history.length > 1) {
    const last = history[history.length - 1];
    const cutoff = Date.parse(last.date) - 30 * DAY;
    const base = [...history].reverse().find((h) => Date.parse(h.date) <= cutoff) ?? history[0];
    change = last.netWorth - base.netWorth;
  }
  // Moves under 0.5% (or ₪100) are noise, not a season.
  const noise = Math.max(100, Math.abs(netWorth) * 0.005);
  const trend: TreeTrend = change > noise ? "up" : change < -noise ? "down" : "flat";

  return { stage, progress, toNext, trend, change };
}
