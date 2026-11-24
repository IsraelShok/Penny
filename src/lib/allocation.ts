/**
 * Automatic split by the 50/30/20 method (net income): 50% needs, 30% wants, 20% savings.
 * Savings go in order: a one-month buffer kept liquid (checking), then a money-market fund
 * until the emergency fund holds EMERGENCY_MONTHS of expenses, then long-term investing.
 * A general rule of thumb, not personal advice.
 */
const RULE = { need: 0.5, want: 0.3, saving: 0.2 } as const;
const BUFFER_MONTHS = 1;
const EMERGENCY_MONTHS = 6;

export interface AllocationInput {
  /** Average monthly net income and expenses. */
  income: number;
  expenses: number;
  /** Money already kept liquid (checking, deposits, money-market). */
  liquidNow: number;
  /** Months of expenses the emergency fund should hold: 3 with stable income, 6 otherwise. */
  emergencyMonths?: number;
}

export interface Allocation {
  targets: Record<keyof typeof RULE, number>;
  /** What is actually left each month (income − expenses), never below 0. */
  surplus: number;
  /** Target balances: kept in checking, in a money-market fund, and the emergency fund total. */
  hold: { liquid: number; moneyMarket: number; emergency: number };
  /** Where this month's surplus should go. */
  monthly: { liquid: number; moneyMarket: number; market: number };
  /** Months of expenses covered now, and months until the emergency fund is full (null = never at this pace). */
  coveredMonths: number;
  monthsToFull: number | null;
}

export function allocate({
  income,
  expenses,
  liquidNow,
  emergencyMonths = EMERGENCY_MONTHS,
}: AllocationInput): Allocation {
  const surplus = Math.max(0, income - expenses);
  const liquid = expenses * BUFFER_MONTHS;
  const emergency = expenses * emergencyMonths;
  const liquidGap = Math.max(0, liquid - liquidNow);
  const mmGap = Math.max(0, emergency - Math.max(liquidNow, liquid));
  const toLiquid = Math.min(surplus, liquidGap);
  const toMm = Math.min(surplus - toLiquid, mmGap);
  const gap = liquidGap + mmGap;
  return {
    targets: { need: income * RULE.need, want: income * RULE.want, saving: income * RULE.saving },
    surplus,
    hold: { liquid, moneyMarket: emergency - liquid, emergency },
    monthly: { liquid: toLiquid, moneyMarket: toMm, market: surplus - toLiquid - toMm },
    coveredMonths: expenses > 0 ? liquidNow / expenses : 0,
    monthsToFull: gap === 0 ? 0 : surplus > 0 ? Math.ceil(gap / surplus) : null,
  };
}

/** Money already on hand for emergencies: cash, deposits, and money-market funds (spotted by name). */
export function liquidCash(
  assets: { type: string; name: string; isLiability: boolean; valueIls: number | null }[],
): number {
  // shortcut: there is no money-market asset type, so a fund counts when its name says so.
  const mm = /כספית|money.?market/i;
  return assets
    .filter(
      (a) =>
        !a.isLiability &&
        (a.type === "cash" || a.type === "deposit" || (a.type === "fund" && mm.test(a.name))),
    )
    .reduce((s, a) => s + (a.valueIls ?? 0), 0);
}
