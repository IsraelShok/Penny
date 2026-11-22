// Income smoothing: a steady "salary to yourself" from irregular income, with a buffer for weak months.
import type { IncomeShape } from "@/lib/household";

const IRREGULAR: readonly IncomeShape[] = ["freelancer", "mixed", "irregular"];

/** Linear-interpolated percentile of a non-empty list. */
export function percentile(values: number[], p: number): number {
  const s = [...values].sort((a, b) => a - b);
  const i = (s.length - 1) * p;
  const lo = Math.floor(i);
  return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo);
}

/** Some month is more than 30% away from the average. */
export function variesALot(incomes: number[]): boolean {
  const avg = incomes.reduce((s, n) => s + n, 0) / incomes.length;
  return avg > 0 && incomes.some((n) => Math.abs(n - avg) / avg > 0.3);
}

export interface Smoothing {
  /** Conservative monthly amount: 25th percentile of past months, rounded down to ₪100. */
  steady: number;
  /** Three months of the steady amount. */
  bufferTarget: number;
  /** This month vs steady: "save" puts the extra aside, "draw" takes the gap from the buffer. */
  thisMonth: { kind: "save" | "draw" | "even"; amount: number };
}

/**
 * `incomes`: income of each past complete month (up to 12). `current`: income this month so far.
 * Null when the income is steady, or there are fewer than 3 months to go on.
 */
export function smoothIncome(
  incomes: number[],
  current: number,
  shape: IncomeShape | null,
): Smoothing | null {
  const months = incomes.filter((n) => n > 0);
  if (months.length < 3) return null;
  if (!(shape && IRREGULAR.includes(shape)) && !variesALot(incomes)) return null;
  const steady = Math.floor(percentile(months, 0.25) / 100) * 100;
  if (steady <= 0) return null;
  const diff = Math.round(current - steady);
  return {
    steady,
    bufferTarget: steady * 3,
    thisMonth:
      diff > 0
        ? { kind: "save", amount: diff }
        : diff < 0
          ? { kind: "draw", amount: -diff }
          : { kind: "even", amount: 0 },
  };
}
