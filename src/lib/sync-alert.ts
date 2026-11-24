/**
 * The Telegram message after a scheduled sync: connections whose state changed (started failing, or
 * recovered), plus a reminder for one that stays down: on its 3rd failing day, then every 7th day after.
 * null when there is nothing to say.
 */
export interface SyncAlertItem {
  label: string;
  ok: boolean;
  /** The previous run of this connection failed. */
  wasFailing: boolean;
  /** Plain-language reason and what to do, already in Hebrew. */
  reason?: string;
  /** Distinct calendar days (Israel time) with a failed run since the last successful one, today included. */
  failedDays?: number;
  /** An earlier run today already failed (the scheduler retries), so today's reminder was already due. */
  failedEarlierToday?: boolean;
  /** Day of the last successful sync, YYYY-MM-DD; null when it never succeeded. */
  lastOk?: string | null;
}

/** Day 3 of a failing streak, then every 7th day after it (10, 17, ...). */
export const reminderDue = (failedDays: number) => failedDays >= 3 && (failedDays - 3) % 7 === 0;

export function syncAlert(items: SyncAlertItem[]): string | null {
  const broke = items.filter((i) => !i.ok && !i.wasFailing);
  const fixed = items.filter((i) => i.ok && i.wasFailing);
  const stuck = items.filter(
    (i) => !i.ok && i.wasFailing && !i.failedEarlierToday && reminderDue(i.failedDays ?? 0),
  );
  if (broke.length === 0 && fixed.length === 0 && stuck.length === 0) return null;
  const lines: string[] = [];
  for (const b of broke)
    lines.push(`⚠️ הסנכרון של ${b.label} נכשל.${b.reason ? `\n${b.reason}` : ""}`);
  if (broke.length) lines.push("נמשיך לנסות בסנכרון הבא. אפשר גם /sync עכשיו.");
  for (const s of stuck) {
    const since = s.lastOk
      ? `לא הסתנכרן מאז ${s.lastOk.split("-").reverse().join(".")}`
      : "עדיין לא הסתנכרן אף פעם";
    lines.push(`⏰ ${s.label} ${since}. כדאי לפתוח את האפליקציה ולבדוק את החיבור.`);
  }
  for (const f of fixed) lines.push(`✓ ${f.label} מסתנכרן שוב.`);
  return lines.join("\n\n");
}
