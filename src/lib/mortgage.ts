/** Israeli mortgage made of tracks (מסלולים). Estimates for comparison, not an offer or advice. */
import { IL } from "./il-defaults";

export type TrackKind = "prime" | "fixed" | "fixedLinked" | "var5" | "var5Linked";
/** Buyer type sets the Bank of Israel loan-to-value cap. */
export type Buyer = "first" | "upgrade" | "investor";

/** Tracks whose rate can't change for the life of the loan. Variable-every-5 counts as variable under the BoI mix rule. */
const FIXED_KINDS: TrackKind[] = ["fixed", "fixedLinked"];
const LINKED_KINDS: TrackKind[] = ["fixedLinked", "var5Linked"];
/** Months between rate resets on a variable-every-5-years track. */
const RESET_MONTHS = 60;

export interface Track {
  kind: TrackKind;
  /** Share of the loan, 0–1. */
  share: number;
  /** Prime: spread over prime (e.g. −0.5). Fixed and var5 tracks: the (starting) annual rate, %. */
  ratePct: number;
  years: number;
}

export interface MortgageInputs {
  loan: number;
  tracks: Track[];
  /** Expected CPI, % a year (linked tracks). */
  inflationPct: number;
  /** Prime today, %. */
  primePct: number;
  /** Change to prime after the first year, and to a var5 rate at each reset, percentage points (stress test). */
  primeShock: number;
  /** Net household income a month, for the payment-to-income check. */
  income: number;
  /** Property value, for the loan-to-value check. */
  propertyValue: number;
  buyer: Buyer;
}

export const MORTGAGE_DEFAULTS: MortgageInputs = {
  loan: 1_200_000,
  tracks: [
    { kind: "prime", share: 1 / 3, ratePct: -0.5, years: 25 },
    { kind: "fixed", share: 1 / 3, ratePct: 5, years: 25 },
    { kind: "fixedLinked", share: 1 / 3, ratePct: 3.3, years: 25 },
  ],
  inflationPct: 2.5,
  primePct: IL.primeRate,
  primeShock: 0,
  income: 25_000,
  propertyValue: 1_800_000,
  buyer: "first",
};

/**
 * Bank of Israel limits (Proper Conduct of Banking Business Directive 329, checked Nov 2026):
 * LTV up to 75% for a single (first) home, 70% for a replacement home, 50% for an investment home;
 * the variable-rate part at most two thirds, so at least a third fixed; payment-to-income up to 50%.
 * Sources: boi.org.il/en/economic-roles/supervision-and-regulation/2503/ltv-limitations-in-housing-loans,
 * leumi.co.il/he/Articles/48371 (variable share ≤ 66.66%), bizportal.co.il/guides/news/article/20041241 (PTI 50%).
 */
export const LIMITS = {
  ltv: { first: 0.75, upgrade: 0.7, investor: 0.5 } as Record<Buyer, number>,
  minFixedShare: 1 / 3,
  maxPti: 0.5,
  warnPti: 0.4,
};

const pmt = (balance: number, monthlyRate: number, n: number) =>
  n <= 0
    ? balance
    : monthlyRate === 0
      ? balance / n
      : (balance * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n));

export interface TrackResult {
  principal: number;
  firstPayment: number;
  maxPayment: number;
  totalPaid: number;
  /** Interest and CPI linkage together: what the loan cost above the principal. */
  cost: number;
}

export function simulateTrack(
  t: Track,
  loan: number,
  i: Pick<MortgageInputs, "inflationPct" | "primePct" | "primeShock">,
): TrackResult {
  const principal = loan * t.share;
  const n = Math.round(t.years * 12);
  const infl = Math.pow(1 + i.inflationPct / 100, 1 / 12) - 1;
  let balance = principal,
    totalPaid = 0,
    firstPayment = 0,
    maxPayment = 0;
  for (let m = 0; m < n && balance > 0.01; m++) {
    // var5: the rate holds for 5 years, then resets; the shock stands in for where the market anchor moved.
    const annual =
      t.kind === "prime"
        ? i.primePct + (m >= 12 ? i.primeShock : 0) + t.ratePct
        : (t.kind === "var5" || t.kind === "var5Linked") && m >= RESET_MONTHS
          ? t.ratePct + i.primeShock
          : t.ratePct;
    const r = Math.max(0, annual) / 100 / 12;
    if (LINKED_KINDS.includes(t.kind)) balance *= 1 + infl;
    // Recomputed monthly: prime follows the rate, a linked track follows the index (the Spitzer payment Israeli banks use).
    const p = pmt(balance, r, n - m);
    balance = balance * (1 + r) - p;
    totalPaid += p;
    if (m === 0) firstPayment = p;
    maxPayment = Math.max(maxPayment, p);
  }
  return { principal, firstPayment, maxPayment, totalPaid, cost: totalPaid - principal };
}

export function mortgage(i: MortgageInputs) {
  const tracks = i.tracks.map((t) => simulateTrack(t, i.loan, i));
  const sum = (k: keyof TrackResult) => tracks.reduce((s, t) => s + t[k], 0);
  const shareTotal = i.tracks.reduce((s, t) => s + t.share, 0);
  const fixedShare = i.tracks
    .filter((t) => FIXED_KINDS.includes(t.kind))
    .reduce((s, t) => s + t.share, 0);
  const firstPayment = sum("firstPayment");
  const ltv = i.propertyValue > 0 ? i.loan / i.propertyValue : 0;
  const pti = i.income > 0 ? firstPayment / i.income : 0;
  return {
    tracks,
    firstPayment,
    // Peaks of separate tracks rarely coincide; their sum is a safe upper bound.
    maxPayment: sum("maxPayment"),
    totalPaid: sum("totalPaid"),
    cost: sum("cost"),
    shareTotal,
    fixedShare,
    ltv,
    pti,
    warnings: {
      shares: Math.abs(shareTotal - 1) > 0.005,
      fixed: fixedShare + 1e-9 < LIMITS.minFixedShare,
      ltv: ltv > LIMITS.ltv[i.buyer],
      pti: pti > LIMITS.maxPti ? "over" : pti > LIMITS.warnPti ? "high" : null,
    },
  };
}

/**
 * Early-repayment (capitalization, עמלת היוון) fee on a fixed or var5 track, before the Banking Order discount.
 * The bank charges what it loses: today's value of the payments you'd skip, discounted at today's average rate
 * for that track, minus the balance. Zero when today's rate is at or above yours, and on prime (no fee).
 * For var5, `horizonMonths` is the time to the next reset; for a fixed track, the months left.
 * Source: Banking Order (Early Repayment of Housing Loan) 2002, as summarized in
 * bizportal.co.il/additives/391/mortgage-refinance.html (Nov 2026). The order's discount (roughly 10–40%,
 * by track and loan age) and small operating fees are left out, so this errs high.
 */
export function prepayFee(p: {
  amount: number;
  ratePct: number;
  marketRatePct: number;
  monthsLeft: number;
  horizonMonths?: number;
}): number {
  const n = Math.round(p.monthsLeft);
  const h = Math.min(n, Math.round(p.horizonMonths ?? n));
  if (p.amount <= 0 || n <= 0 || h <= 0 || p.marketRatePct >= p.ratePct) return 0;
  const r = p.ratePct / 100 / 12,
    q = Math.max(0, p.marketRatePct) / 100 / 12;
  const pay = pmt(p.amount, r, n);
  let balance = p.amount,
    pv = 0;
  for (let k = 1; k <= h; k++) {
    balance = balance * (1 + r) - pay;
    pv += pay / Math.pow(1 + q, k);
  }
  pv += Math.max(0, balance) / Math.pow(1 + q, h);
  return Math.max(0, pv - p.amount);
}

/**
 * Prepay a lump into the mortgage, or invest it? Both measured at the end of the term, after capital-gains tax.
 * Prepay: the fee comes out of the lump, the payment drops, and the drop is invested monthly at the same return.
 * Real terms on a linked track (indexation ignored). An estimate, not advice.
 */
export function prepayVsInvest(p: {
  amount: number;
  fee: number;
  ratePct: number;
  years: number;
  returnPct: number;
  taxRate: number;
}) {
  const n = Math.round(p.years * 12);
  const i = Math.pow(1 + p.returnPct / 100, 1 / 12) - 1;
  const afterTax = (end: number, paidIn: number) => end - Math.max(0, end - paidIn) * p.taxRate;
  const drop = pmt(Math.max(0, p.amount - p.fee), p.ratePct / 100 / 12, n);
  const fvDrop = i === 0 ? drop * n : (drop * (Math.pow(1 + i, n) - 1)) / i;
  const prepay = afterTax(fvDrop, drop * n);
  const invest = afterTax(p.amount * Math.pow(1 + i, n), p.amount);
  return {
    monthlyDrop: drop,
    prepay,
    invest,
    better: prepay >= invest ? ("prepay" as const) : ("invest" as const),
  };
}
