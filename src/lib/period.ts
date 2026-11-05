export type PeriodKind = "month" | "quarter" | "half" | "year";

export const PERIOD_MONTHS: Record<PeriodKind, number> = { month: 1, quarter: 3, half: 6, year: 12 };

export interface PeriodRange {
  kind: PeriodKind;
  /** First month of the period, 1-12. */
  startMonth: number;
  year: number;
  /** Inclusive ISO dates. */
  from: string;
  to: string;
  /** YYYY-MM keys of every month in the period. */
  months: string[];
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Calendar period containing `today`, shifted back `offset` periods (0 = current). */
export function periodRange(kind: PeriodKind, today: Date, offset = 0): PeriodRange {
  const len = PERIOD_MONTHS[kind];
  const index = Math.floor(today.getMonth() / len) - offset;
  const year = today.getFullYear() + Math.floor((index * len) / 12);
  const startMonth = (((index * len) % 12) + 12) % 12 + 1;
  return rangeFrom(kind, year, startMonth);
}

function rangeFrom(kind: PeriodKind, year: number, startMonth: number): PeriodRange {
  const len = PERIOD_MONTHS[kind];
  const months = Array.from({ length: len }, (_, i) => `${year}-${pad(startMonth + i)}`);
  const lastDay = new Date(year, startMonth - 1 + len, 0).getDate();
  return {
    kind,
    startMonth,
    year,
    from: `${year}-${pad(startMonth)}-01`,
    to: `${year}-${pad(startMonth + len - 1)}-${pad(lastDay)}`,
    months,
  };
}

/** The period right before this one. */
export function previousPeriod(r: PeriodRange): PeriodRange {
  const len = PERIOD_MONTHS[r.kind];
  const start = new Date(r.year, r.startMonth - 1 - len, 1);
  return rangeFrom(r.kind, start.getFullYear(), start.getMonth() + 1);
}

/** The same period one year earlier. */
export function samePeriodLastYear(r: PeriodRange): PeriodRange {
  return rangeFrom(r.kind, r.year - 1, r.startMonth);
}

/** Cut a comparison period to the same number of days already elapsed in the current one, so a part-done period is compared fairly. */
export function sameElapsed(base: PeriodRange, current: PeriodRange, today: Date): PeriodRange {
  const start = new Date(`${current.from}T00:00:00`);
  const elapsedDays = Math.floor((today.getTime() - start.getTime()) / 86_400_000);
  const end = new Date(`${base.from}T00:00:00`);
  end.setDate(end.getDate() + elapsedDays);
  const to = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;
  return to < base.to ? { ...base, to } : base;
}

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Months that start on `startDay` (salary or card-bill day): compute calendar periods on
 * `budgetToday(today, startDay)`, then move their dates with `shiftRange`. Month keys stay the same.
 */
export function budgetToday(today: Date, startDay: number): Date {
  const d = new Date(today);
  d.setDate(d.getDate() - (startDay - 1));
  return d;
}

export function shiftRange(r: PeriodRange, startDay: number): PeriodRange {
  if (startDay <= 1) return r;
  return { ...r, from: addDays(r.from, startDay - 1), to: addDays(r.to, startDay - 1) };
}
