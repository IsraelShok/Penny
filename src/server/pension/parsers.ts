import type { PensionAccount } from "israeli-pension-scrapers";

interface ParsedAmount {
  amount: number;
  currency: "ILS" | "USD" | "EUR";
}

/** Parses Hebrew/Israeli currency amounts like `₪ 245,600.00`, `-₪ 500`, or `(500 ₪)`. */
function parseHebrewAmount(text: string): ParsedAmount {
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

export interface RichPensionAccount extends PensionAccount {
  feeDeposit?: number | null;
  feeBalance?: number | null;
  monthlyDeposit?: number | null;
  assetType?: "pension" | "study_fund" | "provident" | "stock" | "cash";
  symbol?: string | null;
  quantity?: number | null;
  costBasis?: number | null;
  liquid?: boolean;
  details?: Record<string, unknown>;
}

export interface ExcellenceSummary {
  portfolioValue: number | null;
  dailyPnl: number | null;
  dailyPnlPct: number | null;
  availableCash: number | null;
}

/** Extracts top-bar portfolio summary from Excellence Trade (`שווי תיק`, `רווח / הפסד יומי`, `יתרה לפעילות`). */
export function parseExcellenceSummary(text: string): ExcellenceSummary {
  const flat = text.replace(/\s+/g, " ").trim();
  const pvMatch = flat.match(/שווי תיק\s*([₪$€]?\s*[\d,]+(?:\.\d+)?)/);
  const pnlMatch = flat.match(
    /רווח\s*\/\s*הפסד יומי\s*([−\-+]?\s*[₪$€]?\s*[\d,]+(?:\.\d+)?)\s*(?:\(([−\-+]?[\d.]+)%\))?/,
  );
  const cashMatch = flat.match(/יתרה לפעילות\s*([₪$€]?\s*[\d,]+(?:\.\d+)?)/);

  const portfolioValue = pvMatch ? parseHebrewAmount(pvMatch[1]).amount : null;
  const dailyPnl = pnlMatch ? parseHebrewAmount(pnlMatch[1]).amount : null;
  const dailyPnlPct = pnlMatch?.[2] ? Number.parseFloat(pnlMatch[2].replace("−", "-")) : null;
  const availableCash = cashMatch ? parseHebrewAmount(cashMatch[1]).amount : null;

  return {
    portfolioValue: portfolioValue && portfolioValue > 0 ? portfolioValue : null,
    dailyPnl: dailyPnl != null && !Number.isNaN(dailyPnl) ? dailyPnl : null,
    dailyPnlPct: dailyPnlPct != null && !Number.isNaN(dailyPnlPct) ? dailyPnlPct : null,
    availableCash: availableCash != null && availableCash >= 0 ? availableCash : null,
  };
}

/** Reads rows from an `.xlsx`, `.csv`, or HTML-table `.xls` export buffer. */
export async function readSpreadsheetRows(buffer: Buffer, filename = ""): Promise<string[][]> {
  const head = buffer.subarray(0, 1024).toString("utf8").trimStart();
  if (/^<(?:!doctype|html|table|thead|tbody)/i.test(head)) {
    const rows: string[][] = [];
    for (const tr of buffer.toString("utf8").matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells: string[] = [];
      for (const td of tr[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)) {
        cells.push(
          td[1].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim(),
        );
      }
      if (cells.some(Boolean)) rows.push(cells);
    }
    return rows;
  }

  if (filename.toLowerCase().endsWith(".csv") || (!head.startsWith("PK") && head.includes(","))) {
    const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
    return text
      .split(/\r?\n/)
      .map((line) => line.split(",").map((c) => c.replace(/^"|"$/g, "").trim()))
      .filter((r) => r.some(Boolean));
  }

  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.worksheets.find((s) => s.rowCount > 0);
  if (!ws) return [];
  const rows: string[][] = [];
  ws.eachRow((row) => {
    const vals = (row.values as unknown[]).slice(1).map((v) => {
      if (v == null) return "";
      if (typeof v === "object" && "result" in (v as Record<string, unknown>)) {
        return String((v as { result?: unknown }).result ?? "").trim();
      }
      if (typeof v === "object" && "text" in (v as Record<string, unknown>)) {
        return String((v as { text?: unknown }).text ?? "").trim();
      }
      return String(v).trim();
    });
    if (vals.some(Boolean)) rows.push(vals);
  });
  return rows;
}

/** Maps rows from Excellence Trade's Excel export + top summary bar into Penny assets. */
export function parseExcellenceRows(
  rows: string[][],
  summary?: ExcellenceSummary,
): RichPensionAccount[] {
  const headerIdx = rows.findIndex(
    (r) =>
      r.some((c) => /שם\s*נייר|שם\s*הנייר|שם\s*ני"ע|תיאור|שם|נייר|security|name/i.test(c)) &&
      r.some((c) => /שווי|יתרה|כמות|value|qty|quantity/i.test(c)),
  );
  const accounts: RichPensionAccount[] = [];

  if (headerIdx >= 0) {
    const header = rows[headerIdx];
    const col = (re: RegExp) => header.findIndex((h) => re.test(h));
    const idxName = col(/שם\s*נייר|שם\s*הנייר|שם\s*ני"ע|תיאור|שם|נייר|security|name/i);
    const idxSymbol = col(/סימול|טיקר|מספר\s*נייר|מס['׳]?\s*נייר|מספר\s*ני"ע|symbol|ticker|isin/i);
    const idxQty = col(/כמות|יחידות|ע\.נ\.|quantity|qty|shares|units/i);
    const idxValue = col(/שווי\s*שוק|שווי\s*נוכחי|שווי\s*בש"ח|שווי\s*תיק|שווי|יתרה|market\s*value|value/i);
    const idxCost = col(/עלות|מחיר\s*קנייה|שער\s*קנייה|שער\s*עלות|מחיר\s*עלות|cost|basis/i);
    const idxCurrency = col(/מטבע|currency/i);

    for (const row of rows.slice(headerIdx + 1)) {
      const name = (idxName >= 0 ? row[idxName] : "")?.trim();
      const symbol = (idxSymbol >= 0 ? row[idxSymbol] : "")?.trim() || null;
      if (!name || /^(סה"כ|סהכ|total)/i.test(name)) continue;

      const valueRaw = idxValue >= 0 ? row[idxValue] : "";
      const parsedVal = valueRaw
        ? parseHebrewAmount(valueRaw)
        : { amount: 0, currency: "ILS" as const };
      const qtyRaw = idxQty >= 0 ? row[idxQty] : "";
      const qtyNum = qtyRaw ? Number.parseFloat(qtyRaw.replace(/[^0-9.\-]/g, "")) : NaN;
      const costRaw = idxCost >= 0 ? row[idxCost] : "";
      const costNum = costRaw ? parseHebrewAmount(costRaw).amount : null;
      const curRaw = (idxCurrency >= 0 ? row[idxCurrency] : "")?.toUpperCase().trim();
      const currency = /^[A-Z]{3}$/.test(curRaw) ? curRaw : parsedVal.currency;

      if (parsedVal.amount <= 0 && (Number.isNaN(qtyNum) || qtyNum <= 0)) continue;

      const rowDetails: Record<string, unknown> = {
        provider: "אקסלנס טרייד",
        ...(summary ? { portfolioSummary: summary } : {}),
      };
      header.forEach((h, i) => {
        if (h && row[i]) rowDetails[h] = row[i];
      });

      accounts.push({
        accountNumber: symbol || name,
        label: `אקסלנס - ${name}`,
        balance: parsedVal.amount,
        currency,
        transactions: [],
        assetType: "stock",
        symbol,
        quantity: Number.isFinite(qtyNum) && qtyNum > 0 ? qtyNum : null,
        costBasis: costNum && costNum > 0 ? costNum : null,
        liquid: true,
        details: rowDetails,
      });
    }
  }

  if (summary?.availableCash != null && summary.availableCash > 0) {
    accounts.push({
      accountNumber: "available-cash",
      label: "אקסלנס טרייד - יתרה לפעילות",
      balance: summary.availableCash,
      currency: "ILS",
      transactions: [],
      assetType: "cash",
      liquid: true,
      details: { provider: "אקסלנס טרייד", portfolioSummary: summary },
    });
  }

  const hasStocks = accounts.some((a) => a.assetType === "stock");
  if (!hasStocks && summary?.portfolioValue) {
    accounts.push({
      accountNumber: "portfolio",
      label: "אקסלנס טרייד - שווי תיק",
      balance: summary.portfolioValue,
      currency: "ILS",
      transactions: [],
      assetType: "stock",
      liquid: true,
      details: { provider: "אקסלנס טרייד", portfolioSummary: summary },
    });
  }

  return accounts;
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
