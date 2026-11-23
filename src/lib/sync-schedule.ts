/**
 * When the daily automatic sync should run. Pure, so the rules can be tested with any clock:
 * once per daily slot (Israel time), caught up after the computer was off or asleep, and retried a few
 * times when a bank failed for a reason that usually clears on its own.
 */
const TZ = "Asia/Jerusalem";
const DAY_MS = 24 * 3600 * 1000;

/** Waits before the 1st, 2nd and 3rd retry of connections that failed transiently. Then the next daily slot. */
export const RETRY_DELAYS_MS = [15 * 60_000, 60 * 60_000, 4 * 60 * 60_000];

function israelWallClockMs(d: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
      .formatToParts(d)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, Number(p.value)]),
  );
  // Some Intl implementations report hour 24 at midnight.
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour % 24,
    parts.minute,
    parts.second,
  );
}

/** Milliseconds from `now` until the next HH:MM in Israel. */
export function msUntilNextSlot(time: string, now = new Date()): number {
  const [hour, minute] = time.split(":").map(Number);
  const nowMs = israelWallClockMs(now);
  const d = new Date(nowMs);
  let slot = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour, minute, 0);
  if (slot <= nowMs) slot += DAY_MS;
  return slot - nowMs;
}

/** The most recent HH:MM in Israel at or before `now`, as a real timestamp. Off by an hour on the two clock-change days, which only shifts that day's catch-up. */
export function lastSlotMs(time: string, now = new Date()): number {
  return now.getTime() + msUntilNextSlot(time, now) - DAY_MS;
}

export interface ScheduleState {
  /** When the last automatic run or retry started; null when there has never been one. */
  lastAttemptMs: number | null;
  /** Connections still waiting for a retry after that attempt. */
  retryPending: boolean;
  /** Retries already made since the last full run. */
  retries: number;
}

export type DueRun = "full" | "retry" | null;

export function dueRun(time: string, state: ScheduleState, now = new Date()): DueRun {
  // One full run per slot, however many slots were missed while the computer was off.
  if (state.lastAttemptMs == null || state.lastAttemptMs < lastSlotMs(time, now)) return "full";
  if (!state.retryPending || state.retries >= RETRY_DELAYS_MS.length) return null;
  return now.getTime() >= state.lastAttemptMs + RETRY_DELAYS_MS[state.retries] ? "retry" : null;
}

/** Resolves with `fallback()` if `work` has not settled within `ms`. The work itself is not cancelled. */
export function withDeadline<T>(work: Promise<T>, ms: number, fallback: () => T): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => resolve(fallback()), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}
