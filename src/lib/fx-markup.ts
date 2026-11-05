/** How much more than the market rate foreign card charges cost. Pure: the server fetches the rates. */

export interface FxCharge {
  /** YYYY-MM-DD */
  date: string;
  /** ISO code of the original amount, e.g. "USD". */
  currency: string;
  /** Amount in that currency; sign is ignored. */
  original: number;
  /** Shekels charged; sign is ignored. */
  charged: number;
}

/** Daily closes per currency (shekels per unit), sorted by date ascending. */
export type DailyRates = Record<string, { date: string; close: number }[]>;

/** The close on or before `date`, or null when the series starts later. */
export function rateOn(closes: { date: string; close: number }[], date: string): number | null {
  let found: number | null = null;
  for (const c of closes) {
    if (c.date > date) break;
    found = c.close;
  }
  return found;
}

// Gaps this wide are a data mismatch (partial refunds, wrong currency), not a fee.
const MAX_RATIO = 1.15;

export function fxMarkup(charges: FxCharge[], rates: DailyRates) {
  let total = 0, charged = 0, fair = 0, count = 0;
  for (const c of charges) {
    const rate = rateOn(rates[c.currency] ?? [], c.date);
    const f = Math.abs(c.original) * (rate ?? 0);
    const paid = Math.abs(c.charged);
    if (!f || !paid || paid / f > MAX_RATIO || f / paid > MAX_RATIO) continue;
    total += Math.max(0, paid - f);
    charged += paid;
    fair += f;
    count++;
  }
  // Net, so day-to-day noise between the card's rate date and the market close cancels out instead of adding up.
  const avgPct = fair ? ((charged - fair) / fair) * 100 : 0;
  return { total, avgPct, count };
}
