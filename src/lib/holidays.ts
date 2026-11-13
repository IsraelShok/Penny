/**
 * Seasonal budget templates (sinking funds) for the big Israeli money months.
 * Amounts are starting points from moneyplan.co.il's 2025 estimates; the user edits them.
 */
import type { PeriodicSuggestion } from "./periodic";

// shortcut: Gregorian months of Pesach and Rosh Hashana through 2032, extend the table before then.
const PESACH: Record<number, string> = { 2026: "04", 2027: "04", 2028: "04", 2029: "03", 2030: "04", 2031: "04", 2032: "04" };
const ROSH_HASHANA: Record<number, string> = { 2026: "09", 2027: "10", 2028: "09", 2029: "09", 2030: "09", 2031: "09", 2032: "09" };

export const HOLIDAYS = [
  { key: "holiday:pesach", name: "פסח", amount: 4500, months: PESACH },
  { key: "holiday:rosh-hashana", name: "ראש השנה וחגי תשרי", amount: 3000, months: ROSH_HASHANA },
  { key: "holiday:august", name: "אוגוסט: קייטנות וחופש", amount: 3500, months: null },
] as const;

/** The next due month (YYYY-MM) at least `lead` months away, so there is time to save; null past the table. */
function nextDue(months: Record<number, string> | null, today: string, lead = 2): string | null {
  const y = Number(today.slice(0, 4));
  const min = `${y}-${today.slice(5, 7)}`;
  for (let year = y; year <= y + 2; year++) {
    const m = months ? months[year] : "08";
    if (!m) return null;
    const due = `${year}-${m}`;
    const gap = (year - y) * 12 + Number(m) - Number(min.slice(5, 7));
    if (gap >= lead) return due;
  }
  return null;
}

/** Holiday templates not yet added or dismissed. */
export function holidaySuggestions(today: string, known: Set<string>): PeriodicSuggestion[] {
  const out: PeriodicSuggestion[] = [];
  for (const h of HOLIDAYS) {
    if (known.has(h.key)) continue;
    const due = nextDue(h.months, today);
    if (due) out.push({ name: h.name, amount: h.amount, everyMonths: 12, nextDue: due, autoKey: h.key });
  }
  return out;
}
