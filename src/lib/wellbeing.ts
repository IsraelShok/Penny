/**
 * CFPB Financial Well-Being Scale, 5-item abbreviated version (items 3, 5, 6, 8, 10 of the 10-item scale).
 * Source: https://files.consumerfinance.gov/f/201512_cfpb_financial-well-being-user-guide-scale.pdf (Appendix A).
 * shortcut: the official score uses a table (raw sum → IRT score, by age and mode); we couldn't read that table,
 * so this maps the 0–4 item mean linearly to 0–100. It approximates the official score; swap in the table to match it.
 */
export const WELLBEING_ITEMS = [
  { id: "never", kind: "describes", positive: false },
  { id: "gettingBy", kind: "describes", positive: false },
  { id: "wontLast", kind: "describes", positive: false },
  { id: "leftOver", kind: "frequency", positive: true },
  { id: "control", kind: "frequency", positive: false },
] as const;

/** answers[i] is the chosen option index: 0 = "Completely"/"Always" … 4 = "Not at all"/"Never". */
export function wellbeingScore(answers: number[]) {
  if (
    answers.length !== WELLBEING_ITEMS.length ||
    answers.some((a) => !Number.isInteger(a) || a < 0 || a > 4)
  )
    return null;
  const points = answers.map((a, i) => (WELLBEING_ITEMS[i].positive ? 4 - a : a));
  return Math.round((points.reduce((s, p) => s + p, 0) / points.length) * 25);
}

export interface WellbeingEntry {
  date: string;
  score: number;
}

export const WELLBEING_DUE_DAYS = 90;

export function parseWellbeingHistory(raw: unknown): WellbeingEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (e): e is WellbeingEntry =>
        !!e &&
        /^\d{4}-\d{2}-\d{2}$/.test(e.date) &&
        Number.isFinite(e.score) &&
        e.score >= 0 &&
        e.score <= 100,
    )
    .map((e) => ({ date: e.date, score: Math.round(e.score) }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-40);
}

/** True when there is no check-in, or the last one is older than 90 days. */
export function wellbeingDue(history: WellbeingEntry[], today: string) {
  const last = history.at(-1);
  if (!last) return true;
  return (
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${last.date}T00:00:00Z`)) / 86_400_000 >
    WELLBEING_DUE_DAYS
  );
}

/** Gentle bands for the interpretation text, no judgement. */
export function wellbeingBand(score: number) {
  return score < 40 ? "low" : score < 60 ? "mid" : "high";
}
