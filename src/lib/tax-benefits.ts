import { IL } from "./il-defaults";
import { bracketTax } from "./net-salary";

/** Estimates for an Israeli resident, not tax advice. All money is annual unless named monthly. */

const POINT_YEAR = IL.creditPointMonthly * 12;
const R = IL.creditPointRules;

/** Rate of the bracket the next shekel of monthly income falls in. */
export function marginalRate(monthly: number): number {
  return IL.taxBracketsMonthly.find(([upTo]) => monthly < upTo)?.[1] ?? 0.5;
}

export interface CreditAnswers {
  sex: "man" | "woman";
  /** Children counted by age this tax year: [born this year, 1–2, 3, 4–5, 6–17, 18]. */
  children: number[];
  singleParent: boolean;
  /** Finished a degree last year. */
  degree: "none" | "ba" | "ma";
  /** Discharged within the last 3 years. */
  service: "none" | "short" | "full";
  /** Year since aliyah, 1–5; 0 = not a recent immigrant. */
  aliyahYear: number;
  monthlyGross: number;
  donations: number;
  lifeInsurance: number;
  /** Private pension deposits (as self-employed / independent member). */
  privatePension: number;
  changedJobs: boolean;
  qualifyingTown: boolean;
}

type CreditCheck =
  | "form101"
  | "fatherKids"
  | "donations"
  | "lifeInsurance"
  | "privatePension"
  | "changedJobs"
  | "qualifyingTown";

/**
 * Points payroll usually applies (resident, sex, children) vs everything the answers entitle to.
 * The refund is capped by the tax actually left to offset.
 */
export function creditCheck(a: CreditAnswers) {
  const table: readonly number[] = a.sex === "woman" ? R.childWoman : R.childMan;
  const childPoints = table.reduce((s: number, p, i) => s + p * Math.max(0, a.children[i] ?? 0), 0);
  const likely = IL.creditPoints[a.sex] + childPoints;
  const extra =
    (a.singleParent ? R.singleParent : 0) +
    (a.degree === "none" ? 0 : R.degree[a.degree]) +
    (a.service === "none" ? 0 : R.service[a.service]) +
    (R.aliyahByYear[a.aliyahYear - 1] ?? 0);

  const income = a.monthlyGross * 12;
  const d = IL.donationCredit;
  const donation =
    a.donations > d.min ? d.rate * Math.min(a.donations, d.maxShareOfIncome * income) : 0;
  const life = IL.lifeInsuranceCreditRate * a.lifeInsurance;
  const se = IL.selfEmployedDeposits;
  // shortcut: treats all salary as eligible for the 5.5% credit part, ignores the 11% deduction; fine for a "worth checking" flag.
  const pension =
    IL.pensionCredit.rate *
    Math.min(a.privatePension, se.pensionCreditPct * Math.min(income, se.pensionIncomeCap));

  const taxLeft = Math.max(0, bracketTax(a.monthlyGross) * 12 - likely * POINT_YEAR);
  const missedValue = extra * POINT_YEAR + donation + life + pension;
  const refund = Math.min(taxLeft, missedValue);

  const checks: CreditCheck[] = [];
  if (extra > 0) checks.push("form101");
  if (a.sex === "man" && childPoints > 0) checks.push("fatherKids");
  if (donation > 0) checks.push("donations");
  if (life > 0) checks.push("lifeInsurance");
  if (pension > 0) checks.push("privatePension");
  if (a.changedJobs) checks.push("changedJobs");
  if (a.qualifyingTown) checks.push("qualifyingTown");

  return { likely, entitled: likely + extra, extra, refund, checks };
}

export interface DepositInput {
  selfEmployed: boolean;
  monthlyIncome: number;
  /** Current monthly deposits: salaried = your own pension share; self-employed = total. */
  pensionMonthly: number;
  /** Salaried = employee + employer together. */
  studyMonthly: number;
}

/**
 * How much pension and study-fund deposit gets the full tax benefit, its ₪ value, and what is left this year.
 * shortcut: one marginal rate for the whole deduction (ignores dropping a bracket); upgrade if users sit on a bracket edge.
 */
export function depositPlan({
  selfEmployed,
  monthlyIncome,
  pensionMonthly,
  studyMonthly,
}: DepositInput) {
  const annual = monthlyIncome * 12;
  const m = marginalRate(monthlyIncome);
  const se = IL.selfEmployedDeposits;
  const credit = IL.pensionCredit.rate;
  let pension: { max: number; value: (d: number) => number };
  let study: { max: number; value: (d: number) => number };
  if (selfEmployed) {
    const q = Math.min(annual, se.pensionIncomeCap);
    const creditPart = se.pensionCreditPct * q;
    pension = {
      max: (se.pensionCreditPct + se.pensionDeductPct) * q,
      value: (d) =>
        credit * Math.min(d, creditPart) +
        m * Math.min(Math.max(0, d - creditPart), se.pensionDeductPct * q),
    };
    const sMax = se.studyDeductPct * Math.min(annual, se.studyIncomeCap);
    study = { max: sMax, value: (d) => m * Math.min(d, sMax) };
  } else {
    const pMax =
      IL.pensionCredit.ofSalary * Math.min(monthlyIncome, IL.pensionCredit.salaryCeiling) * 12;
    pension = { max: pMax, value: (d) => credit * Math.min(d, pMax) };
    // 10% of salary up to the ceiling (7.5% employer + 2.5% you); the employer's three quarters is untaxed income.
    const sMax = 0.1 * Math.min(monthlyIncome, IL.studyFundSalaryCeiling) * 12;
    study = { max: sMax, value: (d) => m * 0.75 * Math.min(d, sMax) };
  }
  const row = (p: typeof pension, monthly: number) => {
    const now = monthly * 12;
    return {
      max: p.max,
      now,
      unused: Math.max(0, p.max - now),
      benefit: p.value(now),
      benefitMax: p.value(p.max),
    };
  };
  const rows = { pension: row(pension, pensionMonthly), study: row(study, studyMonthly) };
  return {
    ...rows,
    marginal: m,
    missed:
      rows.pension.benefitMax - rows.pension.benefit + rows.study.benefitMax - rows.study.benefit,
  };
}

/** Tax saved by selling at a loss in the same year as a gain (Form 867 / annual report). Real gains, 25%. */
export function lossOffset(gains: number, losses: number) {
  const r = IL.capitalGainsTax;
  return {
    taxBefore: r * gains,
    taxAfter: r * Math.max(0, gains - losses),
    saved: r * Math.min(gains, losses),
    carryForward: Math.max(0, losses - gains),
  };
}
