import "server-only";
import { israelToday, utcDay } from "@/server/lib/date-utils";

import { redact } from "@/server/lib/redact";
import type { ScrapedAccount, ScrapedTransaction, ScrapeResult } from "@/server/scrapers/types";

/**
 * Israeli open banking is the Bank of Israel's XS2A standard: a NextGenPSD2
 * (Berlin Group) account information API. A bank, or a licensed aggregator acting
 * for it, answers GET /v1/accounts and GET /v1/accounts/{id}/transactions with a
 * bearer token. We speak that shape directly, so any compliant endpoint works —
 * the fields below are the ones the standard guarantees.
 */
export interface OpenBankingCredentials {
  baseUrl?: string;
  token?: string;
  consentId?: string;
}

interface BgAmount {
  amount?: string;
  currency?: string;
}

interface BgBalance {
  balanceAmount?: BgAmount;
  balanceType?: string;
}

interface BgAccount {
  resourceId?: string;
  id?: string;
  iban?: string;
  bbAN?: string;
  name?: string;
  currency?: string;
  balances?: BgBalance[];
}

interface BgTransaction {
  transactionId?: string;
  bookingDate?: string;
  valueDate?: string;
  transactionAmount?: BgAmount;
  creditDebitIndicator?: "CRDT" | "DBIT" | string;
  creditorName?: string;
  debtorName?: string;
  remittanceInformationUnstructured?: string;
  remittanceInformationUnstructuredArray?: string[];
  additionalInformation?: string;
  bankTransactionCode?: string;
}

type BgLinks = { next?: string | { href?: string } };

interface BgTransactionsResponse {
  transactions?: {
    booked?: BgTransaction[];
    pending?: BgTransaction[];
    _links?: BgLinks;
  };
  _links?: BgLinks;
}

/** A looping `next` link must not hang the sync. */
const MAX_PAGES = 50;

class OpenBankingError extends Error {
  constructor(
    message: string,
    readonly retryable = false,
  ) {
    super(message);
  }
}

function baseUrlOf(credentials: OpenBankingCredentials): string {
  const raw = credentials.baseUrl?.trim();
  if (!raw) throw new Error("Open banking API base URL is missing.");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Open banking API base URL must start with https://.");
  }
  // The bearer token goes to this address: plain http only to this machine (a local test server).
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
    throw new Error("Open banking API base URL must start with https://.");
  }
  if (url.username || url.password)
    throw new Error("Open banking API base URL must not hold a user name or password.");
  return raw.replace(/\/+$/, "");
}

function tokenOf(credentials: OpenBankingCredentials): string {
  const token = credentials.token?.trim();
  if (!token) throw new Error("Open banking API access token is missing.");
  return token;
}

function messageFor(status: number, body: string): string {
  const detail = redact(body.slice(0, 300)).trim();
  // A consent lasts 90 days at most and the person can revoke it at the bank; either way only they can renew it.
  if (status === 401 || status === 403 || /CONSENT_(EXPIRED|INVALID)/.test(body)) {
    return `The open banking consent has expired or was revoked (HTTP ${status}). Renew the consent with your bank, then paste the new access token here.`;
  }
  if (status === 404) {
    return `Open banking endpoint not found (HTTP 404) — check the base URL.${detail ? ` ${detail}` : ""}`;
  }
  if (status === 429) {
    return "Open banking rate limit reached (HTTP 429). Try again in a few minutes.";
  }
  return `Open banking request failed (HTTP ${status}).${detail ? ` ${detail}` : ""}`;
}

async function getJson<T>(credentials: OpenBankingCredentials, url: string): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${tokenOf(credentials)}`,
    Accept: "application/json",
    "X-Request-ID": crypto.randomUUID(),
  };
  const consentId = credentials.consentId?.trim();
  if (consentId) headers["Consent-ID"] = consentId;

  let response: Response;
  try {
    response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Open banking endpoint is unreachable: ${redact(msg)}`);
  }

  const text = await response.text();
  if (!response.ok) {
    throw new OpenBankingError(
      messageFor(response.status, text),
      response.status === 429 || response.status >= 500,
    );
  }
  if (!text.trim()) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Open banking returned a response that is not JSON.");
  }
}

/** The standard wraps the list in `accounts`; some gateways use `data`. */
function accountsOf(payload: unknown): BgAccount[] {
  const record = payload as { accounts?: BgAccount[]; data?: BgAccount[] };
  return record.accounts ?? record.data ?? [];
}

function txnsOf(payload: BgTransactionsResponse): { txn: BgTransaction; pending: boolean }[] {
  const booked = payload.transactions?.booked ?? [];
  const pending = payload.transactions?.pending ?? [];
  return [
    ...booked.map((txn) => ({ txn, pending: false })),
    ...pending.map((txn) => ({ txn, pending: true })),
  ];
}

/** Address of the next page, or null on the last one. The link sits beside the list or at the top level. */
export function nextPageUrl(payload: BgTransactionsResponse, current: string): string | null {
  const next = payload.transactions?._links?.next ?? payload._links?.next;
  const href = typeof next === "string" ? next : next?.href;
  if (!href) return null;
  const url = new URL(href, current);
  // The bearer token follows this link, so it may only lead back to the same server.
  if (url.origin !== new URL(current).origin)
    throw new Error("Open banking returned a next-page link to a different server.");
  return url.href;
}

function balanceOf(account: BgAccount): number | undefined {
  const balances = account.balances ?? [];
  // Prefer the closing/interim booked balance (Berlin Group names or ISO codes), then anything the bank sent.
  const preferred =
    balances.find((b) =>
      /CLBD|ITBD|OPBD|(closing|interim|opening)Booked/i.test(b.balanceType ?? ""),
    ) ?? balances[0];
  const amount = Number(preferred?.balanceAmount?.amount);
  return Number.isFinite(amount) ? amount : undefined;
}

function isoDate(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

function descriptionOf(txn: BgTransaction): string {
  const parts = [
    txn.remittanceInformationUnstructured,
    txn.remittanceInformationUnstructuredArray?.join(" "),
    txn.creditorName,
    txn.debtorName,
    txn.additionalInformation,
  ].filter((part): part is string => Boolean(part && part.trim()));
  const unique = [...new Set(parts.map((p) => p.trim()))];
  return unique.join(" · ") || "Open banking transaction";
}

function toScrapedTransaction(
  txn: BgTransaction,
  pending: boolean,
  today: string,
): ScrapedTransaction {
  const raw = Number(txn.transactionAmount?.amount ?? 0);
  // The standard is signed: a debit (expense) arrives negative, which is also
  // how Penny stores bank charges. Only honour the indicator as a fallback.
  const signed =
    Number.isFinite(raw) && raw !== 0
      ? raw
      : txn.creditDebitIndicator === "DBIT"
        ? -Math.abs(raw)
        : raw;
  const currency = txn.transactionAmount?.currency?.trim() || "ILS";
  const date = isoDate(txn.bookingDate ?? txn.valueDate, today);
  return {
    type: "normal",
    identifier: txn.transactionId,
    date,
    processedDate: date,
    originalAmount: signed,
    originalCurrency: currency,
    chargedAmount: signed,
    chargedCurrency: currency,
    description: descriptionOf(txn),
    memo: txn.bankTransactionCode,
    status: pending ? "pending" : "completed",
  };
}

/**
 * Reads every account the token can see, then the transactions since `startDate`.
 * Shapes the answer as a scrape result, so the sync pipeline stays identical.
 */
export async function connectOpenBanking(
  credentials: Record<string, string>,
  startDate: Date,
): Promise<ScrapeResult> {
  const creds: OpenBankingCredentials = {
    baseUrl: credentials.baseUrl,
    token: credentials.token,
    consentId: credentials.consentId,
  };

  try {
    const base = baseUrlOf(creds);
    const accountsPayload = await getJson<unknown>(creds, `${base}/v1/accounts?withBalance=true`);
    const accounts = accountsOf(accountsPayload);
    if (accounts.length === 0) {
      return {
        success: false,
        accounts: [],
        errorMessage:
          "Open banking returned no accounts. Approve the consent for the accounts you want to share.",
      };
    }

    const today = israelToday();
    const dateFrom = utcDay(startDate);
    const scraped: ScrapedAccount[] = [];

    for (const account of accounts) {
      const accountId = account.resourceId ?? account.id ?? account.iban ?? account.bbAN;
      if (!accountId) continue;
      const transactions: ScrapedTransaction[] = [];
      let url: string | null =
        `${base}/v1/accounts/${encodeURIComponent(accountId)}/transactions?dateFrom=${dateFrom}&dateTo=${today}&bookingStatus=both`;
      const seen = new Set<string>();
      while (url) {
        // A loop or a history longer than this would be saved as if it were complete.
        if (seen.has(url) || seen.size >= MAX_PAGES)
          throw new Error(
            "Open banking kept returning more pages than expected; nothing was saved.",
          );
        seen.add(url);
        const payload: BgTransactionsResponse = await getJson<BgTransactionsResponse>(creds, url);
        for (const { txn, pending } of txnsOf(payload))
          transactions.push(toScrapedTransaction(txn, pending, today));
        url = nextPageUrl(payload, url);
      }
      scraped.push({
        accountNumber: account.iban ?? account.bbAN ?? accountId,
        balance: balanceOf(account),
        transactions,
      });
    }

    const total = scraped.reduce((sum, a) => sum + a.transactions.length, 0);
    console.log(`[open-banking] success: ${scraped.length} account(s), ${total} transaction(s)`);
    return { success: true, accounts: scraped };
  } catch (err) {
    const message = redact(err instanceof Error ? err.message : String(err));
    console.error("[open-banking] failed:", message);
    return {
      success: false,
      accounts: [],
      errorMessage: message,
      retryable: err instanceof OpenBankingError && err.retryable,
    };
  }
}
