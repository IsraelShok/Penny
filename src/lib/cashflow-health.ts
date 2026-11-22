/**
 * Cash-flow warning signs: three or more mean a real cash-flow problem,
 * even on a good salary. Pure: the server feeds it facts from transactions and assets.
 */
export type CashflowSign =
  "overdraft" | "installments" | "loans" | "lateFees" | "noBuffer" | "deficit";

export interface CashflowFacts {
  /** Months (of the last 3) with overdraft interest charged. */
  overdraftMonths: number;
  /** Share of the last 90 days' card spending paid in installments, 0..1. */
  installmentShare: number;
  /** Loan deposits received in the last 6 months. */
  newLoans: number;
  /** Late-payment or bounced-charge fees in the last 6 months. */
  lateFees: number;
  /** Cash and deposits on hand. */
  liquid: number;
  /** Months (of the last 3 full ones) where spending beat income. */
  deficitMonths: number;
}

export const BUFFER_MIN = 1000;

export function cashflowSigns(f: CashflowFacts): CashflowSign[] {
  const signs: CashflowSign[] = [];
  if (f.overdraftMonths >= 2) signs.push("overdraft");
  if (f.installmentShare > 0.15) signs.push("installments");
  if (f.newLoans > 0) signs.push("loans");
  if (f.lateFees > 0) signs.push("lateFees");
  if (f.liquid < BUFFER_MIN) signs.push("noBuffer");
  if (f.deficitMonths >= 2) signs.push("deficit");
  return signs;
}

export type CashflowLevel = "healthy" | "watch" | "problem";
export const cashflowLevel = (signs: CashflowSign[]): CashflowLevel =>
  signs.length >= 3 ? "problem" : signs.length > 0 ? "watch" : "healthy";
