export type ResilienceFactor = "emergency" | "savings" | "debt" | "stability" | "buffer";
export type ResilienceBand = "building" | "steady" | "strong";

export interface ResilienceInput {
  cash: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  /** Any non-mortgage debt above 8% a year, or overdraft interest paid in the last 12 months. */
  highInterestDebt: boolean;
  /** Months among the last 6 with income ≥ expenses, out of `monthsCounted`. */
  goodMonths: number;
  monthsCounted: number;
  /** Free to spend until payday; null when no bank balance has synced. */
  freeToSpend: number | null;
}

export interface Resilience {
  score: number;
  band: ResilienceBand;
  factors: { key: ResilienceFactor; points: number; max: number }[];
  weakest: ResilienceFactor;
  emergencyMonths: number;
  savingsRate: number | null;
}

/** Points out of 100: emergency fund 30, savings rate 25, cash-flow stability 20, debt 15, buffer ahead 10. */
export const WEIGHTS: Record<ResilienceFactor, number> = { emergency: 30, savings: 25, stability: 20, debt: 15, buffer: 10 };

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function resilience(i: ResilienceInput): Resilience {
  const emergencyMonths = i.monthlyExpenses > 0 ? Math.max(0, i.cash) / i.monthlyExpenses : 0;
  const savingsRate = i.monthlyIncome > 0 ? (i.monthlyIncome - i.monthlyExpenses) / i.monthlyIncome : null;
  const share: Record<ResilienceFactor, number> = {
    emergency: clamp01(emergencyMonths / 6),
    savings: clamp01((savingsRate ?? 0) / 0.2),
    stability: i.monthsCounted ? clamp01(i.goodMonths / i.monthsCounted) : 0,
    debt: i.highInterestDebt ? 0 : 1,
    // Unknown balance scores half rather than guessing either way.
    buffer: i.freeToSpend == null ? 0.5 : i.freeToSpend >= 0 ? 1 : 0,
  };
  const factors = (Object.keys(WEIGHTS) as ResilienceFactor[]).map((key) => ({
    key,
    max: WEIGHTS[key],
    points: Math.round(share[key] * WEIGHTS[key]),
  }));
  const score = factors.reduce((s, f) => s + f.points, 0);
  const weakest = [...factors].sort((a, b) => a.points / a.max - b.points / b.max || b.max - a.max)[0].key;
  return {
    score,
    band: score >= 70 ? "strong" : score >= 40 ? "steady" : "building",
    factors,
    weakest,
    emergencyMonths,
    savingsRate,
  };
}
