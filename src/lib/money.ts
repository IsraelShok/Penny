export const fmt = (n: number, locale: string, digits = 0) =>
  n.toLocaleString(locale === "he" ? "he-IL" : "en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });

/** ₪ amount; the LTR isolate keeps the sign in front inside Hebrew text. */
export const shekels = (n: number, locale: string) =>
  `⁦${n < 0 ? "−" : ""}₪${fmt(Math.abs(n), locale)}⁩`;

/**
 * Rounds a money value to agorot without float drift: Math.round(1.005 * 100) is 100, not 101,
 * because 1.005 is really 1.00499999… — so half-up rounding silently loses a cent.
 */
export const roundCents = (n: number): number => {
  if (!Number.isFinite(n)) return 0;
  const cents = Math.round(Number((Math.abs(n) * 100).toPrecision(12)));
  return (n < 0 ? -1 : 1) * (cents / 100);
};

/**
 * roundCents on the named fields of a row or rows, in place. Amounts are stored as REAL shekels, so a
 * SQL SUM carries float drift (0.1 + 0.2 = 0.30000000000000004) unless it is rounded where it is read.
 */
export function roundSums<T extends object>(rows: T[], ...keys: (keyof T)[]): T[];
export function roundSums<T extends object>(row: T, ...keys: (keyof T)[]): T;
export function roundSums<T extends object>(input: T | T[], ...keys: (keyof T)[]): T | T[] {
  for (const row of Array.isArray(input) ? input : [input]) {
    if (!row) continue;
    for (const k of keys) {
      const v = row[k];
      if (typeof v === "number") row[k] = roundCents(v) as T[keyof T];
    }
  }
  return input;
}

/** Short ₪ amount (48.7K, 2.7M) in the same shape as `shekels`: sign, ₪, number, kept LTR inside Hebrew text. */
export const compactShekels = (n: number, locale: string) =>
  `⁦${n < 0 ? "−" : ""}₪${new Intl.NumberFormat(locale === "he" ? "he-IL" : "en-US", { notation: "compact", maximumFractionDigits: 1 }).format(Math.abs(n)).replace(/[\u200e\u200f]/g, "")}⁩`;

/** Like shekels, with "+" on positive amounts too (income, money left). */
export const signedShekels = (n: number, locale: string, digits = 0) =>
  `⁦${n > 0 ? "+" : n < 0 ? "−" : ""}₪${fmt(Math.abs(n), locale, digits)}⁩`;
