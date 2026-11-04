import type { ScrapeResult, ScrapedTransaction } from "./types";

interface RawTxn {
  type?: string;
  identifier?: string | number | null;
  date: string;
  processedDate: string;
  originalAmount: number;
  originalCurrency: string;
  chargedAmount: number;
  chargedCurrency?: string | null;
  description: string;
  memo?: string | null;
  installments?: { number: number; total: number } | null;
  status?: string;
}

interface RawAccount {
  accountNumber: string;
  txns: RawTxn[];
  windowCoverage?: { status: string; reason?: string };
}

export interface RawScrapeResult {
  success: boolean;
  accounts?: RawAccount[];
}

/** Maps a scraper result to ours; fails the whole result if any account's requested window was not reached. */
export function toScrapeResult(result: RawScrapeResult): ScrapeResult {
  const accounts = result.accounts ?? [];

  const unproven = accounts.filter((a) => a.windowCoverage?.status === "unproven");
  if (unproven.length > 0) {
    const names = unproven.map((a) => a.accountNumber).join(", ");
    return {
      success: false,
      accounts: [],
      errorMessage: `Could not confirm the full date range for account ${names}; nothing was saved. Try again later.`,
    };
  }

  return {
    success: true,
    accounts: accounts.map((account) => ({
      accountNumber: account.accountNumber,
      transactions: account.txns.map(
        (txn): ScrapedTransaction => ({
          type: txn.type === "installments" ? "installments" : "normal",
          identifier: txn.identifier ?? undefined,
          date: txn.date,
          processedDate: txn.processedDate,
          originalAmount: txn.originalAmount,
          originalCurrency: txn.originalCurrency,
          chargedAmount: txn.chargedAmount,
          chargedCurrency: txn.chargedCurrency ?? undefined,
          description: txn.description,
          memo: txn.memo ?? undefined,
          installments: txn.installments
            ? { number: txn.installments.number, total: txn.installments.total }
            : undefined,
          status: txn.status === "completed" ? "completed" : "pending",
        })
      ),
    })),
  };
}
