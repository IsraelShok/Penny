/** Pure logic for the bank-fees audit, the lost-money checklist and the rights checker. Estimates, not advice. */
import { IL } from "./il-defaults";

// ── Bank fees ───────────────────────────────────────────────────────────────

export type FeeTrack = keyof typeof IL.bankFeeTracks;

/** The cheapest legally required track that fits your monthly actions, and the yearly saving against what you pay now. */
export function bankFeeAudit(p: { monthlyPaid: number; direct: number; teller: number }): { track: FeeTrack | null; price: number; yearlySaving: number } {
  const track = (Object.keys(IL.bankFeeTracks) as FeeTrack[]).find((k) => p.direct <= IL.bankFeeTracks[k].direct && p.teller <= IL.bankFeeTracks[k].teller) ?? null;
  const price = track ? IL.bankFeeTracks[track].price : 0;
  return { track, price, yearlySaving: track ? Math.max(0, (p.monthlyPaid - price) * 12) : 0 };
}

// ── Lost money (הר הכסף) ────────────────────────────────────────────────────

export const FOUND_KINDS = ["pension", "gemel", "hishtalmut", "bank", "policy"] as const;
export type FoundKind = (typeof FOUND_KINDS)[number];
export type FoundAction = "merge" | "move" | "claim";

/**
 * What to do with an item the official search found.
 * Inactive pension with an active fund elsewhere: merge (איחוד) into the active one, so one set of fees and full cover.
 * Provident or study fund: move (ניוד) to a fund you choose, with low fees; a matured study fund can also be withdrawn.
 * Dormant bank account or a life policy (often of a relative who died): claim it from the bank or insurer.
 */
export function foundAction(kind: FoundKind, hasActivePension: boolean): FoundAction {
  if (kind === "pension") return hasActivePension ? "merge" : "move";
  if (kind === "gemel" || kind === "hishtalmut") return "move";
  return "claim";
}

// ── Rights checker ──────────────────────────────────────────────────────────

export interface RightsAnswers {
  worked: boolean;
  /** Gross monthly income of the household's main earner. */
  income: number;
  kids: number;
  age55: boolean;
  /** Reserve-duty days this year. */
  reserveDays: number;
  renting: boolean;
  lostJob: boolean;
  singleParent: boolean;
  disability: boolean;
}

export const RIGHTS = ["workGrant", "reserveTax", "reserveGrant", "childAllowance", "childSavings", "arnona", "rent", "unemployment"] as const;
export type Right = (typeof RIGHTS)[number];

/**
 * Likely entitlements worth checking. Thresholds are rough on purpose; the official site decides.
 * Reserve duty: tax credit points from 30 days a year, personal-expenses grant from 40 (miluim.idf.il, 2026 policy).
 * Work grant: working parents, or 55+, with a low wage; the average wage stands in for "low" (shortcut: the real
 * ceiling depends on family size, upgrade if the Tax Authority's yearly table is added to il-defaults).
 */
export function likelyRights(a: RightsAnswers): Right[] {
  const lowIncome = a.income > 0 && a.income <= IL.selfEmployedPension.averageWage;
  const out: Right[] = [];
  if (a.worked && lowIncome && (a.kids > 0 || a.age55)) out.push("workGrant");
  if (a.reserveDays >= 30) out.push("reserveTax");
  if (a.reserveDays >= 40) out.push("reserveGrant");
  if (a.kids > 0) out.push("childAllowance", "childSavings");
  if (lowIncome || a.singleParent || a.disability || a.age55) out.push("arnona");
  if (a.renting && (lowIncome || a.singleParent || a.disability)) out.push("rent");
  if (a.lostJob) out.push("unemployment");
  return out;
}

/** Official pages per right; arnona discounts are set by each local authority, so it has none. */
export const RIGHT_LINKS: Record<Right, string | null> = {
  workGrant: "https://www.gov.il/he/service/submitting-an-online-claim-for-job-grant",
  reserveTax: "https://www.miluim.idf.il/benefits-list/",
  reserveGrant: "https://www.miluim.idf.il/benefits-list/",
  childAllowance: "https://www.btl.gov.il/benefits/children/Pages/default.aspx",
  childSavings: "https://www.btl.gov.il/benefits/children/HisahoLayeled/Pages/default.aspx",
  arnona: null,
  rent: "https://www.gov.il/he/service/assistance-rent-or-public-housing",
  unemployment: "https://www.btl.gov.il/benefits/Unemployment/Pages/default.aspx",
};

/** Official lost-money searches (Finance Ministry). */
export const LOST_MONEY_LINKS = {
  pension: "https://itur.mof.gov.il/",
  bank: "https://itur.mof.gov.il/home/bank",
  pensionInfo: "https://www.gov.il/he/service/pension_savings_search",
};
