/** General finance tips: which ones are relevant now, and the tip of the day. Pure so it can be tested. */
import type { Suggestion } from "./suggestions";
import { TIP_ROWS } from "./tips-data";

export const TIP_CATEGORIES = ["budget", "emergency", "debt", "pension", "savings", "tax", "insurance", "banking", "mortgage", "investing", "kids", "shopping", "seasonal", "income", "retirement"] as const;
export type TipCategory = (typeof TIP_CATEGORIES)[number];
export type TipTrigger =
  | "overdraft" | "fees" | "fx" | "taxRefund" | "noEmergency" | "debt" | "kids" | "leak" | "spike" | "idle" | "policy" | "portfolio" | "price" | "duplicate"
  | "taxSeason" | "holidays" | "summer" | "backToSchool" | "yearStart" | "salesSeason";

export interface Tip { id: string; category: TipCategory; triggers: TipTrigger[]; href: string | null; he: { title: string; body: string }; en: { title: string; body: string } }

export const TIPS: Tip[] = TIP_ROWS.map(([id, category, triggers, href, ht, hb, et, eb]) => ({ id, category, triggers, href, he: { title: ht, body: hb }, en: { title: et, body: eb } }));

/** Dismissal key, stored with suggestion dismissals. */
export const tipKey = (id: string) => `tip:${id}`;

const FROM_SUGGESTION: Partial<Record<Suggestion["type"], TipTrigger>> = {
  interest: "overdraft", fees: "fees", fx: "fx", fxMarkup: "fx", taxRefund: "taxRefund", emergency: "noEmergency", debt: "debt",
  leak: "leak", spike: "spike", idle: "idle", policy: "policy", portfolio: "portfolio", price: "price", duplicate: "duplicate",
};

/** Season triggers by month (1-12). Israeli holidays move, so Tishrei and Pesach seasons are approximate. */
function seasonal(month: number): TipTrigger[] {
  const out: TipTrigger[] = [];
  if (month >= 11) out.push("taxSeason", "salesSeason");
  if (month <= 4) out.push("taxSeason");
  if (month === 1) out.push("yearStart");
  if ([3, 4, 9, 10].includes(month)) out.push("holidays");
  if ([6, 7].includes(month)) out.push("summer");
  if (month === 8) out.push("backToSchool");
  return out;
}

/** Active signals from suggestion types (active, not dismissed), household and date. */
export function tipSignals(suggestionTypes: string[], opts: { hasKids: boolean; today: string }): Set<TipTrigger> {
  const s = new Set<TipTrigger>(seasonal(Number(opts.today.slice(5, 7))));
  for (const type of suggestionTypes) { const t = FROM_SUGGESTION[type as Suggestion["type"]]; if (t) s.add(t); }
  if (opts.hasKids) s.add("kids");
  return s;
}

/**
 * Tips not dismissed, triggered ones first (by how many signals match), then general tips (no triggers).
 * Tips with triggers that don't match are left out: they'd be noise.
 */
export function relevantTips(signals: Set<TipTrigger>, dismissed: Set<string>, category?: TipCategory, tips = TIPS): Tip[] {
  const score = (t: Tip) => t.triggers.filter((x) => signals.has(x)).length;
  return tips
    .filter((t) => !dismissed.has(tipKey(t.id)) && (!category || t.category === category) && (t.triggers.length === 0 || score(t) > 0))
    .map((t, i) => ({ t, i, s: score(t) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.t);
}

/** One tip per day, stable all day: even days rotate through triggered tips, odd days through general ones. */
export function tipOfDay(signals: Set<TipTrigger>, dismissed: Set<string>, today: string, tips = TIPS): Tip | null {
  const list = relevantTips(signals, dismissed, undefined, tips);
  if (list.length === 0) return null;
  const triggered = list.filter((t) => t.triggers.length > 0);
  const general = list.filter((t) => t.triggers.length === 0);
  const day = Math.floor(Date.parse(`${today}T00:00:00Z`) / 86_400_000);
  const pool = (day % 2 === 0 && triggered.length) || !general.length ? triggered : general;
  return pool[Math.floor(day / 2) % pool.length];
}
