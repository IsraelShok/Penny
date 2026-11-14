/** Retirement and pension-choice helpers (no I/O, tested). Estimates, not advice. */
import { CAPITAL_GAINS_TAX } from "./tools";

/** Level monthly payment that draws `capital` down to 0 over `months` at monthly rate `r`. */
function drawdown(capital: number, r: number, months: number) {
  if (months <= 0) return 0;
  return r === 0 ? capital / months : (capital * r) / (1 - (1 + r) ** -months);
}

/**
 * Annuity (קצבה) vs capitalisation (היוון) of the same balance.
 * Annuity = balance / conversion factor, for life. Lump = balance after tax, invested and drawn down to 0 by `untilAge`.
 * breakEvenAge: from then on the annuity has paid out more than the lump sum (ignoring returns).
 */
export function annuityVsLump(i: { balance: number; factor: number; age: number; untilAge: number; returnPct: number; lumpTaxPct: number }) {
  const annuity = i.factor > 0 ? i.balance / i.factor : 0;
  const lumpNet = i.balance * (1 - Math.min(100, i.lumpTaxPct) / 100);
  const months = Math.min(1200, Math.max(0, Math.round((i.untilAge - i.age) * 12)));
  const lumpMonthly = drawdown(lumpNet, (1 + i.returnPct / 100) ** (1 / 12) - 1, months);
  const breakEvenAge = annuity > 0 ? i.age + lumpNet / annuity / 12 : null;
  return { annuity, lumpNet, lumpMonthly, breakEvenAge };
}

/**
 * Severance (פיצויים) when changing jobs: withdraw now, or leave it in the fund to compound tax-deferred.
 * Exempt now: the lower of `exemptPerYear` × years and 1.5 × last salary × years; the rest at the marginal rate
 * (shortcut: ignores spreading the tax over years (פריסה); upgrade if users ask for it).
 * Withdrawn money is assumed invested in a taxable account (25% on nominal gains).
 */
export function severanceChoice(i: { amount: number; serviceYears: number; salary: number; yearsToRetire: number; returnPct: number; taxPct: number; exemptPerYear: number }) {
  const exempt = Math.min(i.amount, i.exemptPerYear * i.serviceYears, 1.5 * i.salary * i.serviceYears);
  const taxNow = Math.max(0, i.amount - exempt) * (i.taxPct / 100);
  const net = i.amount - taxNow;
  const growth = (1 + i.returnPct / 100) ** Math.min(100, Math.max(0, i.yearsToRetire));
  const keep = i.amount * growth;
  const invested = net + (net * growth - net) * (1 - CAPITAL_GAINS_TAX);
  return { exempt, taxNow, net, keep, withdrawInvested: invested, lost: keep - invested };
}

export type Risk = "low" | "mid" | "high";
export type TrackKind = "sp500" | "stocks" | "ageBased" | "general" | "bonds" | "selfManaged";

/**
 * Track types to look at first, best fit first, from horizon and risk appetite. A rule of thumb:
 * long horizon and calm with drops → equity/index; short horizon or low tolerance → general/bonds.
 * Self-managed (IRA) only makes sense with a larger balance and the will to manage it.
 */
export function suggestTracks(i: { age: number; horizonYears: number; risk: Risk; balance: number }): TrackKind[] {
  const h = i.horizonYears;
  let out: TrackKind[];
  if (h < 5 || i.risk === "low") out = h < 3 ? ["bonds", "general"] : ["general", "ageBased", "bonds"];
  else if (h >= 15 && i.risk === "high") out = ["sp500", "stocks", "ageBased"];
  else if (h >= 10) out = i.risk === "high" ? ["stocks", "sp500", "ageBased"] : ["ageBased", "sp500", "general"];
  else out = ["ageBased", "general", "stocks"];
  // shortcut: a fixed ₪200k line for when custody fees stop mattering; upgrade to a fee comparison if needed.
  if (i.balance >= 200_000 && i.risk !== "low" && h >= 10) out.push("selfManaged");
  return out;
}

/** Disability / survivor cover check for a pension fund, from the clearing-house report. */
export function coverCheck(i: { disabilityPct: number; hasDependents: boolean; survivorsCovered: boolean }) {
  const notes: ("disabilityLow" | "disabilityOk" | "survivorsMissing" | "survivorsMaybeWaive" | "survivorsOk")[] = [];
  // Pension funds allow up to 75% of insured salary for disability; less leaves a gap if you can't work.
  notes.push(i.disabilityPct < 75 ? "disabilityLow" : "disabilityOk");
  if (i.hasDependents && !i.survivorsCovered) notes.push("survivorsMissing");
  else if (!i.hasDependents && i.survivorsCovered) notes.push("survivorsMaybeWaive");
  else notes.push("survivorsOk");
  return notes;
}
