import { IL } from "@/lib/il-defaults";

/**
 * Gross → net for a salaried Israeli resident, monthly. An estimate, not tax advice:
 * ignores benefits-in-kind, employer study-fund excess, surtax on capital income and special credits.
 */
export interface NetSalaryInput {
  gross: number;
  sex: "man" | "woman";
  extraPoints?: number;
  pensionRate?: number;
  /** 0 to skip the study fund. */
  studyFundRate?: number;
}

/** Progressive tax on a monthly amount. */
export function bracketTax(income: number): number {
  let tax = 0;
  let from = 0;
  for (const [upTo, rate] of IL.taxBracketsMonthly) {
    if (income <= from) break;
    tax += (Math.min(income, upTo) - from) * rate;
    from = upTo;
  }
  return tax;
}

/** Two-tier Bituach Leumi + health, capped at the ceiling. */
export function bituachLeumi(income: number, [reduced, full]: readonly [number, number]): number {
  const base = Math.min(Math.max(income, 0), IL.bituach.ceiling);
  const low = Math.min(base, IL.bituach.reducedUpTo);
  return low * reduced + (base - low) * full;
}

export function netSalary({
  gross,
  sex,
  extraPoints = 0,
  pensionRate = 0.06,
  studyFundRate = 0.025,
}: NetSalaryInput) {
  const pension = gross * pensionRate;
  const studyFund = gross * studyFundRate;
  const credits = (IL.creditPoints[sex] + extraPoints) * IL.creditPointMonthly;
  const pensionCredit =
    IL.pensionCredit.rate *
    Math.min(pension, IL.pensionCredit.ofSalary * Math.min(gross, IL.pensionCredit.salaryCeiling));
  const incomeTax = Math.max(0, bracketTax(gross) - credits - pensionCredit);
  const bituach = bituachLeumi(gross, IL.bituach.employee);
  const net = gross - incomeTax - bituach - pension - studyFund;
  return {
    net,
    incomeTax,
    bituach,
    pension,
    studyFund,
    effectiveTaxRate: gross > 0 ? (incomeTax + bituach) / gross : 0,
  };
}
