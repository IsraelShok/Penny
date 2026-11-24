// Overdraft cost screen and a gentle exit plan.

// Same pattern as OVERDRAFT in suggestions.ts (not exported there).
const OVERDRAFT_INTEREST = /ריבית חובה|ריבית על יתרת חובה|ריבית בגין|ריבית משיכת יתר/i;

export interface OverdraftTxn {
  date: string;
  description: string;
  amount: number;
}

export interface OverdraftCost {
  /** Interest paid in the last 12 months. */
  yearlyInterest: number;
  /** Distinct months with an interest charge in the last 12 months. */
  monthsInOverdraft: number;
}

/** Interest charges (money out matching the pattern) after the same date a year ago. */
export function overdraftCost(txns: OverdraftTxn[], today: string): OverdraftCost {
  const since = `${Number(today.slice(0, 4)) - 1}${today.slice(4)}`;
  const rows = txns.filter(
    (t) =>
      t.amount < 0 && t.date > since && t.date <= today && OVERDRAFT_INTEREST.test(t.description),
  );
  return {
    yearlyInterest: rows.reduce((s, t) => s - t.amount, 0),
    monthsInOverdraft: new Set(rows.map((t) => t.date.slice(0, 7))).size,
  };
}

/** Amount below zero to clear: today's balance if negative, else the forecast low point if it dips. */
export function overdraftDepth(balance: number | null, forecastLow: number | null): number {
  return Math.max(0, -(balance ?? 0), -(forecastLow ?? 0));
}

/** Monthly amount to clear `depth` in `months`, rounded up to ₪50. */
export const monthlyToClear = (depth: number, months: number) =>
  depth > 0 ? Math.ceil(depth / months / 50) * 50 : 0;

export const shouldShowOverdraft = (cost: OverdraftCost, forecastLow: number | null) =>
  cost.yearlyInterest > 0 || (forecastLow ?? 0) < 0;
