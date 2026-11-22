/** Whole months from today's month to a YYYY-MM renewal (negative once passed), and days to its first day. */
export function renewalIn(month: string, today: Date): { months: number; days: number } {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const days = Math.ceil(
    (start.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
      86_400_000,
  );
  return { months: (y - today.getFullYear()) * 12 + (m - 1 - today.getMonth()), days };
}

/** Compare prices from this many days before the renewal month starts. */
export const RENEWAL_HEADS_UP_DAYS = 45;
