// Client-safe date math on YYYY-MM-DD strings, in UTC so the host timezone never shifts a day.
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m0: number, d: number) => new Date(Date.UTC(y, m0, d)).toISOString().slice(0, 10);
const parts = (date: string) => date.split("-").map(Number) as [number, number, number];

export const addDays = (date: string, days: number) => {
  const [y, m, d] = parts(date);
  return ymd(y, m - 1, d + days);
};

/** Same day of month, clamped to the target month's length. */
export function monthDay(year: number, month0: number, day: number): string {
  const y = year + Math.floor(month0 / 12);
  const m0 = ((month0 % 12) + 12) % 12;
  const last = new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
  return `${y}-${pad(m0 + 1)}-${pad(Math.min(day, last))}`;
}

export type Cadence = "weekly" | "monthly" | "yearly";

/** The k-th expected charge after `lastDate` (k = 1 is the next one). */
export function nthCharge(cadence: Cadence, lastDate: string, k: number): string {
  const [y, m, d] = parts(lastDate);
  if (cadence === "weekly") return addDays(lastDate, 7 * k);
  return monthDay(y, m - 1 + (cadence === "monthly" ? k : 12 * k), d);
}

/** Expected charge dates of a series within [from, to]. */
export function chargesBetween(cadence: Cadence, lastDate: string, from: string, to: string): string[] {
  const out: string[] = [];
  for (let k = 1; k < 600; k++) {
    const date = nthCharge(cadence, lastDate, k);
    if (date > to) break;
    if (date >= from) out.push(date);
  }
  return out;
}

export type ForecastEvent = { date: string; amount: number; kind: "income" | "card" | "recurring" };

export interface BalanceForecast {
  events?: ForecastEvent[];
  points: { date: string; balance: number }[];
  low: { date: string; balance: number };
  /** First day the balance goes below zero, if it does. */
  firstNegative: string | null;
  /** First payday after the low point, if one falls inside the window. */
  nextPayday: string | null;
}

/**
 * Bank balance day by day: today's synced balance, plus salary on payday, minus card bills on their
 * forecast dates and recurring bank debits on their expected dates. Today's point is the balance as synced.
 */
export function forecastBalance(input: {
  today: string;
  bank: number;
  payday: number;
  monthlyIncome: number;
  bills: { date: string; total: number }[];
  recurring: { cadence: Cadence; lastDate: string; amount: number }[];
  days?: number;
  scheduled?: {date:string;total:number}[];
}): BalanceForecast {
  const days = input.days ?? 90;
  const end = addDays(input.today, days);
  const from = addDays(input.today, 1);
  const delta = new Map<string, number>();
  const events: ForecastEvent[] = [];
  const add = (date: string, n: number) => delta.set(date, (delta.get(date) ?? 0) + n);

  const [y, m] = parts(input.today);
  const paydays: string[] = [];
  for (let k = 0; k <= 4; k++) {
    const d = monthDay(y, m - 1 + k, input.payday);
    if (d >= from && d <= end) paydays.push(d);
  }
  if (!(input.monthlyIncome > 0)) paydays.length = 0;
  for (const d of paydays) { add(d, input.monthlyIncome); events.push({ date: d, amount: input.monthlyIncome, kind: "income" }); }
  for (const b of input.bills) if (b.date >= from && b.date <= end) { add(b.date, -b.total); events.push({ date: b.date, amount: -b.total, kind: "card" }); }
  for (const s of input.recurring) for (const d of chargesBetween(s.cadence, s.lastDate, from, end)) { add(d, -s.amount); events.push({ date: d, amount: -s.amount, kind: "recurring" }); }

  for(const event of input.scheduled??[]) if(event.date>=from&&event.date<=end) { add(event.date,-event.total); events.push({date:event.date,amount:-event.total,kind:"recurring"}); }
  const points = [{ date: input.today, balance: input.bank }];
  for (let i = 1; i <= days; i++) {
    const date = addDays(input.today, i);
    points.push({ date, balance: points[i - 1].balance + (delta.get(date) ?? 0) });
  }
  const low = points.reduce((a, b) => (b.balance < a.balance ? b : a));
  return {
    points,
    events: events.sort((a, b) => a.date.localeCompare(b.date)),
    low,
    firstNegative: points.find((p) => p.balance < 0)?.date ?? null,
    nextPayday: paydays.find((d) => d > low.date) ?? null,
  };
}

/** Splits a month's charges into small / medium / large by thirds of the month itself; returns the tier of an amount. */
export function sizeTier(amounts: number[]): (amount: number) => 0 | 1 | 2 {
  const sorted = [...amounts].sort((a, b) => a - b);
  const lo = sorted[Math.floor(sorted.length / 3)] ?? 0;
  const hi = sorted[Math.floor((2 * sorted.length) / 3)] ?? 0;
  return (n) => (n >= hi && n > lo ? 2 : n >= lo && n > sorted[0] ? 1 : 0);
}
