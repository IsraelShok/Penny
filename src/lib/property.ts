/** One month of an index series, month as "YYYY-MM". */
export interface IndexPoint {
  month: string;
  value: number;
}

/**
 * Revalue a home by a price index: price × (latest index ÷ index at purchase month).
 * A purchase after the latest published month keeps its price; before the series starts there is no estimate.
 */
export function indexRevaluation(
  purchasePrice: number,
  purchaseMonth: string,
  series: IndexPoint[],
) {
  if (!(purchasePrice > 0) || !/^\d{4}-\d{2}$/.test(purchaseMonth) || series.length === 0)
    return null;
  const sorted = [...series].sort((a, b) => a.month.localeCompare(b.month));
  const latest = sorted[sorted.length - 1];
  if (purchaseMonth < sorted[0].month) return null;
  const base = sorted.findLast((p) => p.month <= purchaseMonth)!;
  const change = latest.value / base.value - 1;
  return { value: Math.round(purchasePrice * (1 + change)), change, indexMonth: latest.month };
}
