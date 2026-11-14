/** Vacation plan stored on a goal (kind "vacation"). Pure, unit-tested. */
import { goalMonthly } from "./plan";

export const TRIP_LINES = ["flights", "lodging", "food", "attractions", "insurance", "transport", "shopping", "other"] as const;
export type TripLine = (typeof TRIP_LINES)[number];

export interface Trip {
  /** YYYY-MM-DD */
  start: string;
  end: string;
  travelers: number;
  lines: Partial<Record<TripLine, number>>;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Validate a trip from the client or storage; null when the dates are missing or reversed. */
export function parseTrip(raw: unknown): Trip | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  const start = typeof r.start === "string" && DATE.test(r.start) ? r.start : null;
  const end = typeof r.end === "string" && DATE.test(r.end) ? r.end : null;
  if (!start || !end || end < start) return null;
  const travelers = Number(r.travelers);
  const l = (r.lines ?? {}) as Record<string, unknown>;
  const lines: Trip["lines"] = {};
  for (const k of TRIP_LINES) {
    const n = Number(l[k]);
    if (Number.isFinite(n) && n > 0 && n < 1e8) lines[k] = Math.round(n);
  }
  return { start, end, travelers: Number.isInteger(travelers) && travelers >= 1 && travelers <= 30 ? travelers : 1, lines };
}

export const tripTotal = (t: Pick<Trip, "lines">) => TRIP_LINES.reduce((s, k) => s + (t.lines[k] ?? 0), 0);

export function tripNights(t: Pick<Trip, "start" | "end">): number {
  return Math.max(0, Math.round((Date.parse(t.end) - Date.parse(t.start)) / 86_400_000));
}

/** Quick estimate for one line: a per-person, per-night amount times travelers and nights (at least one night). */
export const perPersonNight = (rate: number, travelers: number, nights: number) => Math.round(Math.max(0, rate) * travelers * Math.max(1, nights));

/** Monthly saving until the month the trip starts. */
export const tripMonthly = (t: Trip, saved: number, today: Date) => goalMonthly(tripTotal(t), saved, t.start.slice(0, 7), today);
