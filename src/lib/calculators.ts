/** Small household calculators for /calculators. Estimates, not advice. Bigger ones live in tools.ts, fi.ts, plan.ts, net-salary.ts. */
import { spitzer } from "@/lib/tools";

export interface Track { amount: number; ratePct: number; years: number }

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
  const n = Math.max(1, Math.round(months)), r = (1 + returnPct / 100) ** (1 / 12) - 1;
  const gap = target - saved * (1 + r) ** n;
  if (gap <= 0) return 0;
  return r === 0 ? gap / n : (gap * r) / ((1 + r) ** n - 1);
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
export const CALC_SLUGS = ["compound", "fees", "inflation", "goal", "mortgage", "loan", "credit", "leaseBuy", "net", "budget", "emergency", "fire"] as const;
export type CalcSlug = (typeof CALC_SLUGS)[number];
