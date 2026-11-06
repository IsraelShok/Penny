import { debtPayoff } from "./plan";
import { IL } from "./il-defaults";

export interface ScheduleYear {
  year: number;
  interest: number;
  principal: number;
  balance: number;
}

/** Spitzer (fixed payment) schedule, summed per loan year. Empty when the payment never covers the interest. */
export function amortizationSchedule(balance: number, ratePct: number, payment: number): ScheduleYear[] {
  const r = ratePct / 100 / 12;
  if (balance <= 0 || payment <= balance * r) return [];
  const rows: ScheduleYear[] = [];
  let b = balance;
  for (let m = 0; b > 0.005 && m < 1200; m++) {
    if (m % 12 === 0) rows.push({ year: m / 12 + 1, interest: 0, principal: 0, balance: b });
    const row = rows[rows.length - 1];
    const i = b * r;
    const p = Math.min(payment - i, b);
    row.interest += i;
    row.principal += p;
    b -= p;
    row.balance = b;
  }
  return rows;
}

/** Same payment at newRatePct: how many months and how much interest it would save. Null if either rate never pays off. */
export function refinanceCheck(balance: number, ratePct: number, payment: number, newRatePct: number) {
  const now = debtPayoff(balance, ratePct, payment);
  const after = debtPayoff(balance, newRatePct, payment);
  if (!now || !after) return null;
  return { monthsSaved: now.months - after.months, interestSaved: now.interest - after.interest };
}

/** Reference rate for a debt type (not an offer): mortgages ≈ prime − 0.5, other loans ≈ prime + 2. */
export const referenceRate = (type: string) => (type === "mortgage" ? IL.typicalMortgageRate : IL.primeRate + 2);

/** The user's rate is worth a second look when it is this many points above the reference. */
export const REFINANCE_GAP = 0.75;
