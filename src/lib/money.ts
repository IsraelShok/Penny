export const fmt = (n: number, locale: string, digits = 0) =>
  n.toLocaleString(locale === "he" ? "he-IL" : "en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });

/** ₪ amount; the LTR isolate keeps the sign in front inside Hebrew text. */
export const shekels = (n: number, locale: string) => `⁦${n < 0 ? "−" : ""}₪${fmt(Math.abs(n), locale)}⁩`;
