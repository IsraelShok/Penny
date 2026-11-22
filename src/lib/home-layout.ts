// Which small teasers Home shows, from the household profile. Pure; unit-tested.
import type { Household } from "./household";

export type HomeTeaser = "taxSetAside" | "childSpend" | "settleUp" | "freeToSpend";

/** Data the teasers need; a teaser with nothing to show is skipped. */
export interface TeaserData {
  childSpend: boolean;
  settleUp: boolean;
}

const MAX_TEASERS = 2; // stay calm

export function homeTeasers(h: Household, data: TeaserData): HomeTeaser[] {
  const roles = new Set(h.members.map((m) => m.role));
  const out: HomeTeaser[] = [];
  // Retirees and pensioners get no salary/self-employment items.
  if (h.incomeShape === "freelancer" || h.incomeShape === "mixed") out.push("taxSetAside");
  if (roles.has("child") && data.childSpend) out.push("childSpend");
  const sharing = roles.has("partner") || roles.has("roommate") || roles.has("exPartner");
  if (sharing && h.moneyStyle !== "joint" && data.settleUp) out.push("settleUp");
  if (h.incomeShape === "allowance" || h.incomeShape === "none" || h.incomeShape === "irregular")
    out.push("freeToSpend");
  return out.slice(0, MAX_TEASERS);
}
