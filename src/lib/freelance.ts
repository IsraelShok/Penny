import { IL } from "@/lib/il-defaults";
import { bituachLeumi } from "@/lib/net-salary";

/** Monthly set-asides for a self-employed person. An estimate, not tax advice. */
export function freelanceSetAside({ income, expenses, advanceRate = 0.1, vatRegistered = false }: {
  income: number;
  expenses: number;
  /** Income-tax advance (מקדמות) as a share of turnover, as the Tax Authority sets it. */
  advanceRate?: number;
  vatRegistered?: boolean;
}) {
  const profit = Math.max(0, income - expenses);
  const taxAdvance = income * advanceRate;
  // shortcut: BL is charged on profit, not profit minus the deductible part of BL itself; fine for an estimate.
  const bituach = bituachLeumi(profit, IL.bituach.selfEmployed);
  const { averageWage, lowRate, highRate } = IL.selfEmployedPension;
  const half = averageWage / 2;
  const pension = Math.min(profit, half) * lowRate + Math.max(0, Math.min(profit, averageWage) - half) * highRate;
  // Income is entered before VAT; this is the VAT collected on top that goes to the Tax Authority.
  const vat = vatRegistered ? income * IL.vat.rate : 0;
  return { profit, taxAdvance, bituach, pension, vat, total: taxAdvance + bituach };
}

/** Next VAT due date: the 15th of the month after each two-month period (Jan–Feb → 15 Mar, …). */
export function nextVatDue(today: Date): Date {
  const y = today.getFullYear();
  for (let m = 0; m <= 10; m += 2) {
    const due = new Date(y, m, IL.vat.dueDay); // m = 0 is 15 Jan (for Nov–Dec of last year)
    if (due >= new Date(y, today.getMonth(), today.getDate())) return due;
  }
  return new Date(y + 1, 0, IL.vat.dueDay);
}
