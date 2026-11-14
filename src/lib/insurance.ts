/** Likely double insurance in a household's policy list. A prompt to check, not a ruling: estimate, not advice. */
import type { InsurancePolicy } from "./types";

export type OverlapKind = "health" | "shaban" | "life" | "same";

export interface Overlap {
  kind: OverlapKind;
  /** Who the policies cover, as typed; "" is the whole household. */
  who: string;
  /** Policy kind for "same" (e.g. "car"); otherwise the kind that triggered it. */
  policyKind: InsurancePolicy["kind"];
  names: string[];
}

type P = Pick<InsurancePolicy, "name" | "kind" | "insured">;

export function insuranceOverlaps(policies: P[]): Overlap[] {
  const byWho = new Map<string, P[]>();
  for (const p of policies) {
    const who = (p.insured ?? "").trim();
    byWho.set(who, [...(byWho.get(who) ?? []), p]);
  }
  const out: Overlap[] = [];
  for (const [who, list] of byWho) {
    const of = (...kinds: string[]) => list.filter((p) => kinds.includes(p.kind));
    const names = (ps: P[]) => ps.map((p) => p.name);
    const health = of("health"), shaban = of("shaban"), life = of("life", "mortgage_life");
    // Indemnity health cover pays once, however many policies pay for it.
    if (health.length > 1) out.push({ kind: "health", who, policyKind: "health", names: names(health) });
    // Private surgery cover often repeats what the health fund's supplementary plan already gives.
    if (health.length > 0 && shaban.length > 0) out.push({ kind: "shaban", who, policyKind: "shaban", names: names([...health, ...shaban]) });
    // Life cover does add up, but two policies plus the mortgage's is often more than the family needs.
    if (life.length > 1) out.push({ kind: "life", who, policyKind: "life", names: names(life) });
    for (const k of ["disability", "long_term_care", "home", "car", "travel"] as const) {
      const same = of(k);
      if (same.length > 1) out.push({ kind: "same", who, policyKind: k, names: names(same) });
    }
  }
  return out;
}

/** The Capital Market Authority's official lookup of every policy in your name. */
export const HAR_HABITUACH_URL = "https://harb.cma.gov.il/";
