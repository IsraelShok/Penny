// Shared by server and client: no server-only imports here.

/**
 * Format a Date as YYYY-MM-DD in *local* time.
 * Using `toISOString().slice(0, 10)` rolls the date back to UTC midnight,
 * which can shift it by a day in timezones east of UTC (e.g., Asia/Jerusalem).
 */
export function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** UTC calendar day of an instant. For dates built with Date.UTC; for "today" use israelToday(). */
export function utcDay(d: Date): string {
  const iso = d.toISOString();
  return iso.slice(0, 10);
}

// Calendar arithmetic on YYYY-MM-DD strings, done in UTC so the host timezone never shifts a day.

const pad = (n: number) => String(n).padStart(2, "0");

function parts(date: string): [number, number, number] {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  return [y, m, d];
}

/** Day number since the epoch, for day differences. */
export function dayNumber(date: string): number {
  const [y, m, d] = parts(date);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function daysBetween(from: string, to: string): number {
  return dayNumber(to) - dayNumber(from);
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = parts(date);
  return utcDay(new Date(Date.UTC(y, m - 1, d + days)));
}

/** Same day of month, clamped to the target month's length. */
export function monthDate(year: number, month1: number, day: number): string {
  const last = new Date(Date.UTC(year, month1, 0)).getUTCDate();
  return `${year}-${pad(month1)}-${pad(Math.min(day, last))}`;
}

export function addMonths(date: string, months: number): string {
  const [y, m, d] = parts(date);
  const idx = y * 12 + (m - 1) + months;
  return monthDate(Math.floor(idx / 12), (idx % 12) + 1, d);
}

/** YYYY-MM of `date` shifted by whole months. */
export function monthKey(date: string, shift = 0): string {
  const [y, m] = parts(date);
  const idx = y * 12 + (m - 1) + shift;
  return `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`;
}

const israelFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" });

/** Today's date in Israel, whatever time zone the host runs in. */
export function israelToday(now: Date = new Date()): string {
  return israelFormat.format(now);
}

/** Israeli calendar day of a date or instant. Scrapers send UTC instants (Israeli midnight reads as 21:00/22:00Z the day before); transactions are stored as the day this returns. */
export function israelDay(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value.slice(0, 10) : israelFormat.format(d);
}

/**
 * Israel's calendar day as a host-local Date at noon, for code that does local-calendar arithmetic
 * (getMonth, toLocalISODate). `new Date()` there answers the host's day, which in Docker is UTC.
 */
export function israelNoon(now: Date = new Date()): Date {
  const [y, m, d] = israelToday(now).split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}
