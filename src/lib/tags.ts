// Pure logic for tags/events, mine-yours-ours owners and the cash wallet (no I/O, unit-tested).

export const SHARED = "shared";
export const CASH_PROVIDER = "cash";
export const WALLET_DAYS = 60;

/** Trimmed, single-spaced tag, or null when empty/too long. */
export function normalizeTag(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const tag = raw.trim().replace(/\s+/g, " ");
  return tag && tag.length <= 40 ? tag : null;
}

// ---- Tags -----------------------------------------------------------------

export interface TagRow { tag: string; amount: number; date: string; category: string | null }
export interface TagTotal { tag: string; total: number; count: number; from: string; to: string }

/** Spending per tag (expenses positive; refunds inside the tag reduce it), biggest first. */
export function tagTotals(rows: TagRow[]): TagTotal[] {
  const map = new Map<string, TagTotal>();
  for (const r of rows) {
    const t = map.get(r.tag) ?? { tag: r.tag, total: 0, count: 0, from: r.date, to: r.date };
    t.total -= r.amount;
    t.count += 1;
    if (r.date < t.from) t.from = r.date;
    if (r.date > t.to) t.to = r.date;
    map.set(r.tag, t);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

/** Category breakdown of one tag, biggest first. `category` null = uncategorized. */
export function tagBreakdown(rows: TagRow[], tag: string): { category: string | null; total: number }[] {
  const map = new Map<string | null, number>();
  for (const r of rows) if (r.tag === tag) map.set(r.category, (map.get(r.category) ?? 0) - r.amount);
  return [...map].map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
}

// ---- Owners ---------------------------------------------------------------

export type AccountOwners = Record<string, string>;
export interface OwnerRow { amount: number; owner: string | null; accountNumber: string }
export interface OwnerSummary {
  byOwner: Record<string, number>; // member id or "shared" -> spent
  unset: number;
  settlements: { from: string; to: string; amount: number }[];
}

/** Row owner, falling back to the account's default owner. */
export function effectiveOwner(owner: string | null, accountNumber: string, accountOwners: AccountOwners): string | null {
  return owner ?? accountOwners[accountNumber] ?? null;
}

/**
 * Spending per owner, plus who owes whom for shared expenses: split evenly between members,
 * the payer is the account's default owner (a shared or unknown account settles nothing).
 */
export function ownerSummary(rows: OwnerRow[], accountOwners: AccountOwners, memberIds: string[], payingIds = memberIds): OwnerSummary {
  const byOwner: Record<string, number> = {};
  const net: Record<string, number> = Object.fromEntries(payingIds.map((m) => [m, 0])); // kids don't split shared costs
  let unset = 0;
  for (const r of rows) {
    const spent = -r.amount;
    const owner = effectiveOwner(r.owner, r.accountNumber, accountOwners);
    if (owner == null || (owner !== SHARED && !memberIds.includes(owner))) { unset += spent; continue; }
    byOwner[owner] = (byOwner[owner] ?? 0) + spent;
    const payer = accountOwners[r.accountNumber];
    if (owner === SHARED && payer && payingIds.includes(payer) && payingIds.length > 1) {
      net[payer] += spent;
      for (const m of payingIds) net[m] -= spent / payingIds.length;
    }
  }
  // Greedy settle: biggest debtor pays biggest creditor until everyone is even.
  const settlements: OwnerSummary["settlements"] = [];
  const left = Object.entries(net).map(([id, v]) => ({ id, v }));
  for (;;) {
    left.sort((a, b) => a.v - b.v);
    const debtor = left[0];
    const creditor = left[left.length - 1];
    if (!debtor || debtor.v > -0.5 || creditor.v < 0.5) break;
    const amount = Math.min(-debtor.v, creditor.v);
    settlements.push({ from: debtor.id, to: creditor.id, amount: Math.round(amount) });
    debtor.v += amount;
    creditor.v -= amount;
  }
  return { byOwner, unset, settlements };
}

/** Validates a stored/submitted owner value. */
export function isValidOwner(v: unknown, memberIds: string[]): v is string {
  return v === SHARED || (typeof v === "string" && memberIds.includes(v));
}

// ---- Cash wallet ----------------------------------------------------------

const ATM_RE = /כספומט|משיכת מזומן|\bATM\b/i;

export interface WalletRow { amount: number; description: string; categoryName: string | null; provider: string }

export function isAtmWithdrawal(r: WalletRow): boolean {
  return r.provider !== CASH_PROVIDER && r.amount < 0 && (r.categoryName === "Cash & ATM" || ATM_RE.test(r.description));
}

/** Withdrawn cash minus logged cash spending; never below zero (logging more than withdrawn is fine). */
export function walletBalance(rows: WalletRow[]): { withdrawn: number; logged: number; balance: number } {
  let withdrawn = 0;
  let logged = 0;
  for (const r of rows) {
    if (r.provider === CASH_PROVIDER) logged -= r.amount;
    else if (isAtmWithdrawal(r)) withdrawn -= r.amount;
  }
  return { withdrawn, logged, balance: Math.max(0, withdrawn - logged) };
}
