import type { PensionAccount } from "israeli-pension-scrapers";

export interface ParsedAmount {
  amount: number;
  currency: "ILS" | "USD" | "EUR";
}

/** Parses Hebrew/Israeli currency amounts like `₪ 245,600.00`, `-₪ 500`, or `(500 ₪)`. */
export function parseHebrewAmount(text: string): ParsedAmount {
  if (!text || typeof text !== "string") {
    return { amount: 0, currency: "ILS" };
  }

  const trimmed = text.trim();
  let currency: "ILS" | "USD" | "EUR" = "ILS";
  if (trimmed.includes("$") || trimmed.toUpperCase().includes("USD")) {
    currency = "USD";
  } else if (trimmed.includes("€") || trimmed.toUpperCase().includes("EUR")) {
    currency = "EUR";
  }

  const numberTokenMatch = trimmed.match(
    /(\([-−\s₪$€\u20aa]*\d[\d,.]*[\s₪$€\u20aa]*\)|[-−]?\s*[₪$€\u20aa]?\s*[-−]?\s*\d[\d,.]*)/,
  );
  if (!numberTokenMatch) {
    return { amount: 0, currency };
  }

  const token = numberTokenMatch[1];
  const isNegative =
    token.includes("-") ||
    token.includes("\u2212") ||
    (token.startsWith("(") && token.endsWith(")"));

  const cleaned = token.replace(/[^0-9.,]/g, "");
  if (!cleaned) {
    return { amount: 0, currency };
  }

  let normalized = cleaned;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    normalized =
      cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else if (cleaned.includes(",")) {
    const parts = cleaned.split(",");
    normalized =
      parts.length === 2 && parts[1].length !== 3
        ? cleaned.replace(",", ".")
        : cleaned.replace(/,/g, "");
  }

  let amount = Number.parseFloat(normalized);
  if (Number.isNaN(amount)) {
    return { amount: 0, currency };
  }
  if (isNegative && amount > 0) {
    amount = -amount;
  }

  return { amount, currency };
}

export interface AltshulerBox {
  accNum: string;
  trackName: string;
  amount: string;
}

/** Extracts Altshuler Shaham accounts from DOM boxes, top total, or raw HTML fallback. */
export function extractAltshulerAccounts(
  boxes: AltshulerBox[],
  topTotal: string,
  htmlContent: string,
  idNumber?: string,
): PensionAccount[] {
  const accounts: PensionAccount[] = [];
  const fallbackAcc = idNumber || "main";

  for (const box of boxes) {
    const parsed = parseHebrewAmount(box.amount);
    if (parsed.amount > 0) {
      const accountNumber = box.accNum || fallbackAcc;
      const label = box.trackName
        ? `אלטשולר שחם (${box.trackName})`
        : `אלטשולר שחם - ת"ז ${fallbackAcc}`;
      accounts.push({
        accountNumber,
        label,
        balance: parsed.amount,
        currency: parsed.currency,
        transactions: [],
      });
    }
  }

  if (accounts.length === 0 && topTotal) {
    const parsed = parseHebrewAmount(topTotal);
    if (parsed.amount > 0) {
      accounts.push({
        accountNumber: fallbackAcc,
        label: `אלטשולר שחם - ת"ז ${fallbackAcc}`,
        balance: parsed.amount,
        currency: parsed.currency,
        transactions: [],
      });
    }
  }

  if (accounts.length === 0) {
    const matchBalance =
      htmlContent.match(/total-balance["']>([^<]+)</i) ||
      htmlContent.match(
        /(?:סה"כ|שווי התיק|צבירה|יתרה)[^0-9\-(₪$€]*([₪$€\s\-−()0-9,.]+)/i,
      );
    if (matchBalance) {
      const parsed = parseHebrewAmount(matchBalance[1]);
      if (parsed.amount > 0) {
        const matchAcc =
          htmlContent.match(/account-number["']>([^<]+)</i) ||
          htmlContent.match(/מספר חשבון[^0-9]*([0-9]+)/i);
        const accountNumber = matchAcc ? matchAcc[1].trim() : fallbackAcc;
        accounts.push({
          accountNumber,
          label: `אלטשולר שחם - ת"ז ${fallbackAcc}`,
          balance: parsed.amount,
          currency: parsed.currency,
          transactions: [],
        });
      }
    }
  }

  return accounts;
}
