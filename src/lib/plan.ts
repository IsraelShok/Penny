/** Advisor checks on top of net worth: fees, debts, goals, allocation. Pure functions so they can be tested. */

/**
 * Typical competitive fees in Israel (% a year), used as the "market" comparison. Rough reference points,
 * not quotes: pension from deposit and balance, study and provident funds on balance only.
 */
// Pension: the level of the default ('kranot bererat mechdal') funds, about 1% / 0.22%. Study/provident: a typical competitive level. Caps are in il-defaults.
export const BENCHMARK_FEES: Record<string, { deposit: number; balance: number }> = {
  pension: { deposit: 1, balance: 0.22 },
  study_fund: { deposit: 0, balance: 0.6 },
  provident: { deposit: 0, balance: 0.6 },
};

/** Balance after `years` with monthly deposits, given yearly gross return and fees in percent. */
export function projectBalance(balance: number, monthlyDeposit: number, years: number, grossReturn: number, feeDepositPct: number, feeBalancePct: number): number {
  const monthly = Math.pow(1 + grossReturn - feeBalancePct / 100, 1 / 12) - 1;
  let b = balance;
  for (let m = 0; m < Math.round(years * 12); m++) b = b * (1 + monthly) + monthlyDeposit * (1 - feeDepositPct / 100);
  return b;
}

/** What your fees cost by retirement compared with benchmark fees (positive = you lose that much). */
export function feeCost(
  type: string,
  balance: number,
  monthlyDeposit: number,
  years: number,
  feeDepositPct: number,
  feeBalancePct: number,
  grossReturn = 0.05
): { yours: number; benchmark: number; cost: number } | null {
  const bench = BENCHMARK_FEES[type];
  if (!bench || years <= 0) return null;
  const yours = projectBalance(balance, monthlyDeposit, years, grossReturn, feeDepositPct, feeBalancePct);
  const benchmark = projectBalance(balance, monthlyDeposit, years, grossReturn, Math.min(feeDepositPct, bench.deposit), Math.min(feeBalancePct, bench.balance));
  return { yours, benchmark, cost: benchmark - yours };
}

/** Months to pay off a debt and the interest paid; null if the payment doesn't cover the interest. */
export function debtPayoff(balance: number, ratePct: number, payment: number): { months: number; interest: number } | null {
  const r = ratePct / 100 / 12;
  if (balance <= 0) return { months: 0, interest: 0 };
  if (payment <= balance * r) return null;
  let b = balance;
  let interest = 0;
  let months = 0;
  while (b > 0.005 && months < 1200) {
    const i = b * r;
    interest += i;
    b = b + i - payment;
    months++;
  }
  return { months, interest };
}

/** Monthly saving needed to reach a goal by its date (0 if already funded; the whole gap if the date has passed). */
export function goalMonthly(target: number, saved: number, targetDate: string, today: Date): number {
  const gap = target - saved;
  if (gap <= 0) return 0;
  const [y, m] = targetDate.split("-").map(Number);
  const months = (y - today.getFullYear()) * 12 + (m - 1 - today.getMonth());
  return months > 0 ? gap / months : gap;
}

export const ALLOCATION_CLASSES = ["equity", "bonds", "cash"] as const;
export type AllocationClass = (typeof ALLOCATION_CLASSES)[number];

/** Which liquid asset types count toward each class of the target allocation. */
export const CLASS_OF: Record<string, AllocationClass> = {
  stock: "equity", fund: "equity", crypto: "equity", metal: "equity", study_fund: "equity", provident: "equity",
  bond: "bonds",
  cash: "cash", deposit: "cash",
};

export interface FinancialPlan {
  /** Day of the month your month starts (salary or card bill day), 1-28. */
  monthStartDay: number;
  birthYear: number | null;
  retirementAge: number;
  emergencyMonths: number;
  allocation: Record<AllocationClass, number>;
  /** Yearly tax checklist, keyed by item, value = year last done. */
  taxDone: Record<string, number>;
}

export const DEFAULT_PLAN: FinancialPlan = {
  monthStartDay: 1,
  birthYear: null,
  retirementAge: 67,
  emergencyMonths: 6,
  allocation: { equity: 70, bonds: 20, cash: 10 },
  taxDone: {},
};

const int = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
};

/** Validate a plan from the client or storage; unknown or bad fields fall back to defaults. */
export function parsePlan(raw: unknown): FinancialPlan {
  const r = (raw ?? {}) as Record<string, unknown>;
  const a = (r.allocation ?? {}) as Record<string, unknown>;
  const t = (r.taxDone ?? {}) as Record<string, unknown>;
  return {
    monthStartDay: int(r.monthStartDay, 1, 28, DEFAULT_PLAN.monthStartDay),
    birthYear: r.birthYear == null || r.birthYear === "" ? null : int(r.birthYear, 1920, 2015, 0) || null,
    retirementAge: int(r.retirementAge, 40, 80, DEFAULT_PLAN.retirementAge),
    emergencyMonths: int(r.emergencyMonths, 1, 24, DEFAULT_PLAN.emergencyMonths),
    allocation: Object.fromEntries(ALLOCATION_CLASSES.map((c) => [c, int(a[c], 0, 100, DEFAULT_PLAN.allocation[c])])) as Record<AllocationClass, number>,
    taxDone: Object.fromEntries(Object.entries(t).filter(([k, v]) => /^[a-z_]{1,30}$/.test(k) && Number.isInteger(v)).slice(0, 20)) as Record<string, number>,
  };
}
