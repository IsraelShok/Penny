import { utcDay } from "./dates";
// Calendar math on "YYYY-MM-DD" in UTC, so DST and the viewer's time zone never shift a day.
const DAY = 864e5;
const toUtc = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const fromUtc = (ms: number) => utcDay(new Date(ms));

/** Today's calendar date on this device, as "YYYY-MM-DD". */
export const localToday = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Sunday that opens the (Israeli) week holding `iso`. */
export function weekStart(iso: string): string {
  const ms = toUtc(iso);
  return fromUtc(ms - new Date(ms).getUTCDay() * DAY);
}

export type WeekGroup<T> = { start: string; end: string; items: T[] };

/** Splits a date-sorted list into runs of the same week, keeping the list's order. */
export function groupByWeek<T extends { date: string }>(items: T[]): WeekGroup<T>[] {
  const out: WeekGroup<T>[] = [];
  for (const item of items) {
    const start = weekStart(item.date);
    const last = out.at(-1);
    if (last?.start === start) last.items.push(item);
    else out.push({ start, end: fromUtc(toUtc(start) + 6 * DAY), items: [item] });
  }
  return out;
}

/** Whether a week (by its Sunday) is this week or last week, relative to `today`. */
export function weekRelation(start: string, today: string): "this" | "last" | null {
  const current = weekStart(today);
  if (start === current) return "this";
  return start === fromUtc(toUtc(current) - 7 * DAY) ? "last" : null;
}
