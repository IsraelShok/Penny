const DAY = 86_400_000;
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);

/**
 * Age of Money: income fills buckets in date order, each expense spends from the oldest bucket first.
 * Returns the amount-weighted average age (days) of the last 10 expenses, or null when none could be aged.
 * shortcut: money held before the first transaction is unknown, so ages are a floor; pass ~90 days of data.
 */
export function ageOfMoney(txns: { date: string; amount: number }[]): number | null {
  const sorted = [...txns].sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount);
  const buckets: { date: string; left: number }[] = [];
  const events: { age: number; amount: number }[] = [];
  for (const t of sorted) {
    if (t.amount > 0) {
      buckets.push({ date: t.date, left: t.amount });
      continue;
    }
    let need = -t.amount;
    let spent = 0;
    let ageSum = 0;
    while (need > 0 && buckets.length) {
      const b = buckets[0];
      const take = Math.min(need, b.left);
      ageSum += take * days(b.date, t.date);
      spent += take;
      need -= take;
      b.left -= take;
      if (b.left <= 0) buckets.shift();
    }
    // Spending with no recorded income behind it can't be aged.
    if (spent > 0) events.push({ age: ageSum / spent, amount: spent });
  }
  const last = events.slice(-10);
  const total = last.reduce((s, e) => s + e.amount, 0);
  return total ? Math.round(last.reduce((s, e) => s + e.age * e.amount, 0) / total) : null;
}
