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

export interface PhoenixSavingItem {
  name: string;
  accountNumber: string;
  amount: string;
}

export interface PhoenixProductDetail {
  name: string;
  accountNumber: string;
  text: string;
}

export interface RichPensionAccount extends PensionAccount {
  feeDeposit?: number | null;
  feeBalance?: number | null;
  monthlyDeposit?: number | null;
  details?: Record<string, unknown>;
}

/** Parses a product card text from Phoenix's `/savings` ("פירוט מוצרים") tab. */
export function parsePhoenixProductDetail(
  item: PhoenixProductDetail,
  fallbackAcc = "main",
): RichPensionAccount | null {
  const text = item.text.replace(/\s+/g, " ").trim();
  const balanceMatch = text.match(/סכום חיסכון\s*([₪$€]?\s*[\d,]+(?:\.\d+)?)/);
  if (!balanceMatch) return null;

  const parsed = parseHebrewAmount(balanceMatch[1]);
  if (parsed.amount <= 0) return null;

  const depositSection = text.match(/הפקדה אחרונה\s*([^\s].{0,40})/)?.[1] ?? "";
  const lastDepositDate = depositSection.match(/(\d{2}\.\d{2}\.\d{4})/)?.[1] ?? null;
  const depositAmountStr = lastDepositDate
    ? depositSection.slice(0, depositSection.indexOf(lastDepositDate))
    : depositSection;
  const depositAmountMatch = depositAmountStr.match(/([₪$€]?\s*[\d,]+(?:\.\d+)?)/);
  const monthlyDeposit = depositAmountMatch ? parseHebrewAmount(depositAmountMatch[1]).amount : null;

  const liquidityMatch = text.match(/מועד נזילות\s*(\d{2}\.\d{2}\.\d{4})/);
  const feeDepositMatch = text.match(/ד\.נ הפקדה\s*([\d.]+)\s*%/);
  const feeBalanceMatch = text.match(/ד\.נ חיסכון\s*([\d.]+)\s*%/);
  const statusMatch = text.match(/מעמד\s*(שכיר|עצמאי|לא פעיל|פעיל|[^\s]+)/);

  const liquidityDate = liquidityMatch?.[1] ?? null;
  const feeDeposit = feeDepositMatch ? Number.parseFloat(feeDepositMatch[1]) : null;
  const feeBalance = feeBalanceMatch ? Number.parseFloat(feeBalanceMatch[1]) : null;
  const employmentStatus = statusMatch?.[1]?.replace(/פירוט.*$/, "").trim() || null;

  const details: Record<string, unknown> = {
    provider: "הפניקס",
    policyNumber: item.accountNumber || fallbackAcc,
    ...(monthlyDeposit != null ? { lastDeposit: { amount: monthlyDeposit, date: lastDepositDate } } : {}),
    ...(liquidityDate ? { liquidityDate } : {}),
    ...(employmentStatus ? { status: employmentStatus } : {}),
  };

  return {
    accountNumber: item.accountNumber || fallbackAcc,
    label: item.name ? `הפניקס - ${item.name}` : "הפניקס",
    balance: parsed.amount,
    currency: parsed.currency,
    transactions: [],
    feeDeposit: Number.isFinite(feeDeposit) ? feeDeposit : null,
    feeBalance: Number.isFinite(feeBalance) ? feeBalance : null,
    monthlyDeposit: monthlyDeposit != null && monthlyDeposit > 0 ? monthlyDeposit : null,
    details,
  };
}

/** Extracts Phoenix accounts from saving items, dashboard total, or legacy HTML fallback. */
export function extractPhoenixAccounts(
  htmlContent: string,
  idNumber?: string,
  savingItems: PhoenixSavingItem[] = [],
): PensionAccount[] {
  const accounts: PensionAccount[] = [];
  const fallbackAcc = idNumber || "main";

  for (const item of savingItems) {
    const parsed = parseHebrewAmount(item.amount);
    if (parsed.amount > 0) {
      accounts.push({
        accountNumber: item.accountNumber || fallbackAcc,
        label: item.name ? `הפניקס - ${item.name}` : "הפניקס",
        balance: parsed.amount,
        currency: parsed.currency,
        transactions: [],
      });
    }
  }
  if (accounts.length > 0) {
    return accounts;
  }

  const itemMatches = htmlContent.matchAll(/<app-saving-item[\s\S]*?<\/app-saving-item>/gi);
  for (const m of itemMatches) {
    const block = m[0];
    const nameMatch = block.match(/<h3[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/i);
    const accMatch = block.match(/dir=["']ltr["'][^>]*>([^<]+)</i);
    const amountMatch = block.match(/([₪$€]\s*[\d,]+(?:\.\d+)?)/);
    if (amountMatch) {
      const parsed = parseHebrewAmount(amountMatch[1]);
      if (parsed.amount > 0) {
        const name = nameMatch?.[1]?.trim() || "חיסכון";
        accounts.push({
          accountNumber: accMatch?.[1]?.trim() || fallbackAcc,
          label: `הפניקס - ${name}`,
          balance: parsed.amount,
          currency: parsed.currency,
          transactions: [],
        });
      }
    }
  }
  if (accounts.length > 0) {
    return accounts;
  }

  const totalBlockMatch = htmlContent.match(
    /סה"כ השקעות וחסכונות[\s\S]{0,400}?([₪$€])<\/span>\s*<span[^>]*>([\d,]+(?:\.\d+)?)<\/span>/i,
  );
  const matchBalance = totalBlockMatch
    ? `${totalBlockMatch[1]}${totalBlockMatch[2]}`
    : (
        htmlContent.match(/class=["']sum["']>([^<]+)</i) ||
        htmlContent.match(
          /(?:סה"כ צבירה|יתרה כוללת|שווי נכסים)[^0-9\-(₪$€]*([₪$€\s\-−()0-9,.]+)/i,
        )
      )?.[1];

  if (!matchBalance) {
    return [];
  }

  const parsed = parseHebrewAmount(matchBalance);
  if (parsed.amount <= 0) {
    return [];
  }

  const matchAcc = htmlContent.match(/account-id["']>([^<]+)</i);
  const accountNumber = matchAcc ? matchAcc[1].trim() : fallbackAcc;

  return [
    {
      accountNumber,
      label: "פוליסת חיסכון / פנסיה הפניקס",
      balance: parsed.amount,
      currency: parsed.currency,
      transactions: [],
    },
  ];
}
