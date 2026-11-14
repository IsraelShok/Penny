// Spots likely life-stage changes from transactions. Hints only — Penny never decides, and hard events are never guessed.
import type { SuggestionTxn } from "./suggestions";
import type { LifeEventType } from "./household";

export type DetectableEvent = "homePurchase" | "birth" | "retirement" | "startedBusiness";
export interface StageHint { key: string; event: DetectableEvent }

const MORTGAGE = /משכנתא|משכנתה|mortgage/i;
const MATERNITY = /דמי לידה|מענק לידה|maternity/i;
const BABY = /שילב|מוצצים|\bbaby\b|תינוק/i;
const OLD_AGE = /קצבת זקנה|קצבת אזרח ותיק|old.?age/i;
const TAX_ADVANCE = /מקדמות מס|מקדמה.*מס הכנסה|ביטוח לאומי.*עצמאי/i;

export function detectStageChanges(txns: SuggestionTxn[], knownEvents: LifeEventType[], today: string): StageHint[] {
  const d = new Date(`${today}T00:00:00`);
  d.setMonth(d.getMonth() - 6);
  const since = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const recent = txns.filter((t) => t.date.slice(0, 10) >= since);
  const out = recent.filter((t) => t.amount < 0);
  const inc = recent.filter((t) => t.amount > 0);
  const monthsOf = (re: RegExp) => new Set(out.filter((t) => re.test(t.description)).map((t) => t.date.slice(0, 7))).size;
  const has = (e: LifeEventType) => knownEvents.includes(e);

  const hints: DetectableEvent[] = [];
  if (!has("homePurchase") && monthsOf(MORTGAGE) >= 2) hints.push("homePurchase");
  if (!has("birth") && !has("newChild") &&
    (inc.some((t) => MATERNITY.test(t.description)) || out.filter((t) => BABY.test(t.description)).length >= 2)) hints.push("birth");
  if (!has("retirement") && inc.some((t) => OLD_AGE.test(t.description))) hints.push("retirement");
  if (!has("startedBusiness") && monthsOf(TAX_ADVANCE) >= 2) hints.push("startedBusiness");
  return hints.map((event) => ({ key: `stageask:${event}`, event }));
}
