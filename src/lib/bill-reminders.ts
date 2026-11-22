/** One expected charge: a detected recurring series or a commitment, on one date. */
export interface ExpectedBill {
  /** Stable per source (series key or commitment id); the date is added to make each occurrence unique. */
  source: string;
  name: string;
  /** Positive shekels. */
  amount: number;
  /** YYYY-MM-DD */
  date: string;
}

export interface BillReminder extends ExpectedBill {
  /** One key per charge occurrence, so the bell and the bot remind once. */
  key: string;
  daysLeft: number;
}

const dayNum = (ymd: string) => Date.parse(`${ymd}T00:00:00Z`) / 86_400_000;

/**
 * Bills due from today through `daysBefore` days ahead, soonest first. 0 (or less) turns reminders off.
 * A bill also listed under a second source on the same date and amount (a commitment that tracks a
 * detected series) is reminded once.
 */
export function dueReminders(
  bills: ExpectedBill[],
  today: string,
  daysBefore: number,
): BillReminder[] {
  if (!(daysBefore > 0)) return [];
  const seen = new Set<string>();
  const out: BillReminder[] = [];
  for (const b of [...bills].sort((a, c) => a.date.localeCompare(c.date))) {
    const daysLeft = Math.round(dayNum(b.date) - dayNum(today));
    if (daysLeft < 0 || daysLeft > daysBefore) continue;
    const dup = `${b.date}|${b.name.trim().toLowerCase()}|${Math.round(b.amount)}`;
    if (seen.has(dup)) continue;
    seen.add(dup);
    out.push({ ...b, key: `bill-${b.source}-${b.date}`, daysLeft });
  }
  return out;
}

/** Keys still worth remembering as sent: the ones that are still due. Keeps the stored list from growing. */
export function pendingToSend(
  due: BillReminder[],
  sent: readonly string[],
): { send: BillReminder[]; keep: string[] } {
  return {
    send: due.filter((r) => !sent.includes(r.key)),
    keep: due.map((r) => r.key),
  };
}
