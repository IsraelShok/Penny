/** Israeli mortgage made of tracks (מסלולים). Estimates for comparison, not an offer or advice. */
import { IL } from "./il-defaults";

export type TrackKind = "prime" | "fixed" | "fixedLinked";

export interface Track {
  kind: TrackKind;
  /** Share of the loan, 0–1. */
  share: number;
  /** Prime: spread over prime (e.g. −0.5). Fixed tracks: the annual rate, %. */
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
  /** Change to prime after the first year, percentage points (stress test). */
  primeShock: number;
  /** Net household income a month, for the payment-to-income check. */
  income: number;
  /** Property value, for the loan-to-value check. */
  propertyValue: number;
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
};

/** Bank of Israel limits: LTV 75% for a first home, at least a third fixed-rate, payment up to 50% of income. */
export const LIMITS = { ltv: 0.75, minFixedShare: 1 / 3, maxPti: 0.5, warnPti: 0.4 };

const pmt = (balance: number, monthlyRate: number, n: number) =>
  n <= 0 ? balance : monthlyRate === 0 ? balance / n : (balance * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n));

export interface TrackResult {
  principal: number;
  firstPayment: number;
  maxPayment: number;
  totalPaid: number;
  /** Interest and CPI linkage together: what the loan cost above the principal. */
  cost: number;
}

export function simulateTrack(t: Track, loan: number, i: Pick<MortgageInputs, "inflationPct" | "primePct" | "primeShock">): TrackResult {
  const principal = loan * t.share;
  const n = Math.round(t.years * 12);
  const infl = Math.pow(1 + i.inflationPct / 100, 1 / 12) - 1;
  let balance = principal, totalPaid = 0, firstPayment = 0, maxPayment = 0;
  for (let m = 0; m < n && balance > 0.01; m++) {
    const annual = t.kind === "prime" ? i.primePct + (m >= 12 ? i.primeShock : 0) + t.ratePct : t.ratePct;
    const r = Math.max(0, annual) / 100 / 12;
    if (t.kind === "fixedLinked") balance *= 1 + infl;
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
  const fixedShare = i.tracks.filter((t) => t.kind !== "prime").reduce((s, t) => s + t.share, 0);
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
      ltv: ltv > LIMITS.ltv,
      pti: pti > LIMITS.maxPti ? "over" : pti > LIMITS.warnPti ? "high" : null,
    },
  };
}
