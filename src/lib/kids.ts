// Per-child spending summary and investments (pure, unit-tested).
import { projectBalance } from "./plan";

export interface ChildRow {
  date: string;
  amount: number;
  category: string | null;
}
export interface ChildSummary {
  month: number;
  year: number;
  top: { category: string | null; total: number }[];
}

/** Spent this month (`month` = YYYY-MM) and this year, plus the year's top 3 categories. Refunds reduce totals. */
export function childSummary(rows: ChildRow[], month: string): ChildSummary {
  const year = month.slice(0, 4);
  let m = 0;
  let y = 0;
  const cats = new Map<string | null, number>();
  for (const r of rows) {
    if (!r.date.startsWith(year)) continue;
    y -= r.amount;
    if (r.date.startsWith(month)) m -= r.amount;
    cats.set(r.category, (cats.get(r.category) ?? 0) - r.amount);
  }
  const top = [...cats]
    .map(([category, total]) => ({ category, total }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 3);
  return { month: m, year: y, top };
}

// ---- Investments for a child ----

/** The state's monthly deposit per child (savings for every child); the parent may add the same again. */
export const STATE_MONTHLY_PER_CHILD = 57;
export const KID_TRACKS = ["low", "medium", "high", "halacha", "bank"] as const;
export type KidTrack = (typeof KID_TRACKS)[number];

export interface KidPlan {
  /** Household member id (role "child"). */
  memberId: string;
  /** Current balance of the state savings account, as you read it. */
  stateValue: number;
  track: KidTrack;
  /** Parent matches the state's deposit from child allowance. */
  doubling: boolean;
  /** Parent's own monthly deposit for this child (e.g. an investment provident fund). */
  extraMonthly: number;
  /** Expected yearly return, % (editable). */
  returnPct: number;
  /** Holdings from the assets list set aside for this child. */
  assetIds: number[];
}

/**
 * Value at 18 and 21. State account: deposits until 18, then growth only.
 * Parent money (holdings + extra monthly) keeps its deposits to 21. No fees, no taxes, no bonuses.
 */
export function kidProjection(
  p: Pick<KidPlan, "stateValue" | "doubling" | "extraMonthly" | "returnPct">,
  holdings: number,
  age: number,
) {
  const r = p.returnPct / 100;
  const to18 = Math.max(0, 18 - age),
    to21 = Math.max(0, 21 - age);
  const stateMonthly = STATE_MONTHLY_PER_CHILD * (p.doubling ? 2 : 1);
  const state18 = projectBalance(p.stateValue, stateMonthly, to18, r, 0, 0);
  const state21 = projectBalance(state18, 0, to21 - to18, r, 0, 0);
  const parent18 = projectBalance(holdings, p.extraMonthly, to18, r, 0, 0);
  const parent21 = projectBalance(holdings, p.extraMonthly, to21, r, 0, 0);
  return {
    state18,
    state21,
    parent18,
    parent21,
    at18: state18 + parent18,
    at21: state21 + parent21,
  };
}

const num = (v: unknown, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= max ? n : 0;
};

/** Validate kid plans from the client or storage. */
export function parseKids(raw: unknown): KidPlan[] {
  return (Array.isArray(raw) ? raw : [])
    .filter(
      (k): k is Record<string, unknown> =>
        !!k && typeof k === "object" && typeof k.memberId === "string" && !!k.memberId,
    )
    .slice(0, 20)
    .map((k) => ({
      memberId: String(k.memberId).slice(0, 40),
      stateValue: num(k.stateValue, 1e8),
      track: KID_TRACKS.includes(k.track as KidTrack) ? (k.track as KidTrack) : "medium",
      doubling: k.doubling === true,
      extraMonthly: num(k.extraMonthly, 1e6),
      returnPct:
        k.returnPct == null || !Number.isFinite(Number(k.returnPct))
          ? 4
          : Math.min(15, Math.max(0, Number(k.returnPct))),
      assetIds: (Array.isArray(k.assetIds) ? k.assetIds : [])
        .filter((n): n is number => Number.isInteger(n))
        .slice(0, 50),
    }));
}
