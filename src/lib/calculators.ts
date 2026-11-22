/** Small household calculators for /calculators. Estimates, not advice. Bigger ones live in tools.ts, fi.ts, plan.ts, net-salary.ts. */
import { spitzer } from "@/lib/tools";

export interface Track {
  amount: number;
  ratePct: number;
  years: number;
}

/** Spitzer loan: monthly payment, total paid and interest. A mortgage is the sum of its tracks. */
export function loan({ amount, ratePct, years }: Track) {
  const monthly = spitzer(amount, ratePct / 100, years);
  const total = amount > 0 ? monthly * Math.max(1, Math.round(years * 12)) : 0;
  return { monthly, total, interest: total - Math.max(0, amount) };
}

/** Mortgage of several tracks (prime, fixed…), each a simple Spitzer track. Ignores CPI linkage and prime changes. */
export function mortgage(tracks: Track[]) {
  const parts = tracks.filter((t) => t.amount > 0).map(loan);
  const sum = (k: "monthly" | "total" | "interest") => parts.reduce((s, p) => s + p[k], 0);
  return { monthly: sum("monthly"), total: sum("total"), interest: sum("interest") };
}

/** What `amount` today buys after `years` of `inflationPct` a year, and what you'd need then to keep its value. */
export function inflation(amount: number, inflationPct: number, years: number) {
  const f = (1 + inflationPct / 100) ** years;
  return { realValue: amount / f, needed: amount * f };
}

/** Monthly deposit to reach `target` in `months`, starting from `saved`, at `returnPct` a year (monthly compounding). */
export function savingsGoal(target: number, saved: number, months: number, returnPct: number) {
  const n = Math.max(1, Math.round(months)),
    r = (1 + returnPct / 100) ** (1 / 12) - 1;
  const gap = target - saved * (1 + r) ** n;
  if (gap <= 0) return 0;
  // r is a computed periodic rate, so compare it to zero with a tolerance, not ===.
  return Math.abs(r) < 1e-12 ? gap / n : (gap * r) / ((1 + r) ** n - 1);
}

/** 50/30/20 split of net monthly income: needs, wants, savings. */
export function split503020(net: number) {
  return { needs: net * 0.5, wants: net * 0.3, savings: net * 0.2 };
}

export interface LeaseBuyInputs {
  price: number;
  /** Resale value at the end, in % of price. */
  residualPct: number;
  years: number;
  /** Loan rate when buying with a loan; 0 when paying cash (then it's the lost return). */
  ratePct: number;
  leaseMonthly: number;
  leaseUpfront: number;
}

/**
 * Lease vs buy a car over the same years, in total out-of-pocket cost.
 * Buy = price − resale + interest (Spitzer on the full price, or lost return on cash at the same rate).
 * Lease = upfront + monthly × months. Running costs that both pay (fuel, test) are left out; insurance/maintenance
 * included in some leases are not.
 */
export function leaseVsBuy(i: LeaseBuyInputs) {
  const months = Math.max(1, Math.round(i.years * 12));
  const resale = i.price * (i.residualPct / 100);
  const interest = loan({ amount: i.price, ratePct: i.ratePct, years: i.years }).interest;
  const buy = i.price - resale + interest;
  const lease = i.leaseUpfront + i.leaseMonthly * months;
  return { buy, lease, diff: lease - buy, buyMonthly: buy / months, leaseMonthly: lease / months };
}

/** Pages under /calculators/[slug]. */
export const CALC_SLUGS = [
  "compound",
  "fees",
  "inflation",
  "goal",
  "mortgage",
  "loan",
  "credit",
  "leaseBuy",
  "net",
  "budget",
  "emergency",
  "fire",
  "annuity",
  "severance",
  "lossOffset",
] as const;
export type CalcSlug = (typeof CALC_SLUGS)[number];

/** Balance after `years` of monthly deposits at an annual return (fees already netted out). */
export function growth(initial: number, monthly: number, years: number, annualReturn: number) {
  const r = Math.pow(1 + annualReturn, 1 / 12) - 1;
  const yearly: { year: number; deposited: number; balance: number }[] = [];
  let balance = initial;
  for (let m = 1; m <= Math.round(years * 12); m++) {
    balance = balance * (1 + r) + monthly;
    if (m % 12 === 0) yearly.push({ year: m / 12, deposited: initial + monthly * m, balance });
  }
  const deposited = initial + monthly * Math.round(years * 12);
  return { balance, deposited, earned: balance - deposited, yearly };
}

export interface Debt {
  name: string;
  balance: number;
  /** Annual rate, %. */
  ratePct: number;
  minPayment: number;
}

export type DebtStrategy = "avalanche" | "snowball";

/**
 * Pay every debt's minimum, put the rest of `budget` on one target debt, and roll freed minimums over.
 * Avalanche targets the highest rate (least interest); snowball the smallest balance (quick wins).
 * Returns null when the budget doesn't cover the minimums.
 */
export function payoffPlan(debts: Debt[], budget: number, strategy: DebtStrategy) {
  const live = debts.filter((d) => d.balance > 0).map((d) => ({ ...d }));
  if (live.reduce((s, d) => s + d.minPayment, 0) > budget + 0.01) return null;
  const order = [...live].sort((a, b) =>
    strategy === "avalanche" ? b.ratePct - a.ratePct : a.balance - b.balance,
  );
  const paidOff: { name: string; month: number }[] = [];
  let interest = 0;
  let month = 0;
  while (order.some((d) => d.balance > 0.005) && month < 1200) {
    month++;
    let left = budget;
    for (const d of order) {
      if (d.balance <= 0.005) continue;
      const i = d.balance * (d.ratePct / 100 / 12);
      interest += i;
      d.balance += i;
    }
    for (const d of order) {
      if (d.balance <= 0.005) continue;
      const pay = Math.min(d.minPayment, d.balance, left);
      d.balance -= pay;
      left -= pay;
    }
    for (const d of order) {
      if (left <= 0) break;
      if (d.balance <= 0.005) continue;
      const pay = Math.min(d.balance, left);
      d.balance -= pay;
      left -= pay;
    }
    for (const d of order)
      if (d.balance <= 0.005 && !paidOff.some((p) => p.name === d.name))
        paidOff.push({ name: d.name, month });
  }
  // A budget that never beats the interest keeps the loop at its cap.
  if (month >= 1200) return null;
  return { months: month, interest, paidOff };
}

export interface Room {
  kind: "kitchen" | "bathroom" | "room" | "flooring" | "paint" | "other";
  /** Cost in ₪ for this room at the chosen finish. */
  cost: number;
}

/** Typical Israeli renovation costs in ₪ by finish level, Nov 2026. Editable estimates. */
export const RENO_COSTS: Record<Room["kind"], [basic: number, standard: number, premium: number]> =
  {
    kitchen: [35_000, 60_000, 110_000],
    bathroom: [20_000, 35_000, 60_000],
    room: [8_000, 15_000, 28_000],
    flooring: [15_000, 30_000, 55_000],
    paint: [5_000, 9_000, 15_000],
    other: [0, 0, 0],
  };

/** Renovation total with a buffer for surprises, and how to pay: savings first, the gap as a loan. */
export function renovationBudget(
  rooms: Room[],
  bufferPct: number,
  savings: number,
  loanRatePct: number,
  loanYears: number,
) {
  const base = rooms.reduce((s, r) => s + r.cost, 0);
  const buffer = base * bufferPct;
  const total = base + buffer;
  const loan = Math.max(0, total - savings);
  const n = Math.round(loanYears * 12);
  const r = loanRatePct / 100 / 12;
  const monthly =
    loan <= 0 || n <= 0 ? 0 : r === 0 ? loan / n : (loan * r) / (1 - Math.pow(1 + r, -n));
  return {
    base,
    buffer,
    total,
    fromSavings: Math.min(savings, total),
    loan,
    monthly,
    interest: monthly * n - loan,
  };
}
