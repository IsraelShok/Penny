// Split ledger and settle-up with one household member (pure, unit-tested).
import { SHARED, effectiveOwner, type AccountOwners } from "./tags";

interface Support {
  monthly: number;
  direction: "pay" | "receive";
  start: string;
} // start: YYYY-MM
export interface SplitRule {
  myShare: number;
  support: Support | null;
} // myShare: % of shared costs that is mine
export type SplitRules = Record<string, SplitRule>;
export const DEFAULT_RULE: SplitRule = { myShare: 50, support: null };

export interface SettleRow {
  id: number;
  date: string;
  amount: number;
  owner: string | null;
  accountNumber: string;
  description: string;
}
export interface SettleEntry {
  id: number;
  counterpart: string;
  date: string;
  amount: number;
}
export interface LedgerLine {
  date: string;
  description: string;
  kind: "shared" | "theirs" | "mine" | "support" | "carry";
  amount: number;
} // amount > 0: toward me
export interface Ledger {
  lines: LedgerLine[];
  balance: number;
  since: string | null;
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Validates one rule from untrusted input; throws on bad shape. */
export function parseSplitRule(raw: unknown): SplitRule {
  const o = (raw ?? {}) as Record<string, unknown>;
  const share = o.myShare;
  if (typeof share !== "number" || !Number.isFinite(share) || share < 0 || share > 100)
    throw new Error("invalid share");
  let support: Support | null = null;
  if (o.support != null) {
    const s = o.support as Record<string, unknown>;
    if (
      typeof s.monthly !== "number" ||
      !Number.isFinite(s.monthly) ||
      s.monthly <= 0 ||
      s.monthly > 1e7
    )
      throw new Error("invalid amount");
    if (s.direction !== "pay" && s.direction !== "receive") throw new Error("invalid direction");
    if (typeof s.start !== "string" || !MONTH_RE.test(s.start)) throw new Error("invalid start");
    support = { monthly: s.monthly, direction: s.direction, start: s.start };
  }
  return { myShare: share, support };
}

/** Stored rules, dropping members that left the household or entries that no longer parse. */
export function parseSplitRules(raw: unknown, memberIds: string[]): SplitRules {
  const out: SplitRules = {};
  for (const [id, r] of Object.entries((raw ?? {}) as Record<string, unknown>)) {
    if (!memberIds.includes(id)) continue;
    try {
      out[id] = parseSplitRule(r);
    } catch {
      /* skip */
    }
  }
  return out;
}

const round = (n: number) => Math.round(n * 100) / 100;

function nextMonth(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
}

/**
 * Balance with `counterpart`. Payer = the account's default owner; refunds (amount > 0) reverse a charge.
 * Shared costs split by rule; a cost owned by one side but paid by the other counts in full.
 * Child support counts once per month on the 1st, from its start month up to `today`.
 * Each settle-up pays its amount toward whoever was owed on its date; an unpaid remainder carries over.
 * `lines` are the ones after the last settle-up, plus a "carry" line for that remainder.
 */
export function ledger(
  rows: SettleRow[],
  accountOwners: AccountOwners,
  me: string,
  counterpart: string,
  rule: SplitRule,
  entries: SettleEntry[],
  today: string,
): Ledger {
  const settles = entries
    .filter((e) => e.counterpart === counterpart)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));
  const since = settles.at(-1)?.date ?? null;
  // Stored dates may carry a time; compare by day.
  const open = (date: string) => date.slice(0, 10) <= today;
  const lines: LedgerLine[] = [];
  for (const r of rows) {
    if (!open(r.date) || r.amount === 0) continue;
    const spent = -r.amount;
    const owner = effectiveOwner(r.owner, r.accountNumber, accountOwners);
    const payer = accountOwners[r.accountNumber];
    const add = (kind: LedgerLine["kind"], amount: number) =>
      lines.push({ date: r.date, description: r.description, kind, amount: round(amount) });
    if (payer === me && owner === SHARED) add("shared", (spent * (100 - rule.myShare)) / 100);
    else if (payer === me && owner === counterpart) add("theirs", spent);
    else if (payer === counterpart && owner === SHARED)
      add("shared", (-spent * rule.myShare) / 100);
    else if (payer === counterpart && owner === me) add("mine", -spent);
  }
  const s = rule.support;
  if (s) {
    for (let m = s.start, i = 0; `${m}-01` <= today && i < 1200; m = nextMonth(m), i++) {
      const date = `${m}-01`;
      if (open(date))
        lines.push({
          date,
          description: "",
          kind: "support",
          amount: s.direction === "receive" ? s.monthly : -s.monthly,
        });
    }
  }
  lines.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  let carry = 0;
  let i = lines.length - 1; // lines are newest first; walk oldest first
  for (const e of settles) {
    for (; i >= 0 && lines[i].date.slice(0, 10) <= e.date; i--) carry += lines[i].amount;
    carry = round(carry - Math.sign(carry) * e.amount);
  }
  const after = lines.slice(0, i + 1);
  if (since && carry !== 0)
    after.push({ date: since, description: "", kind: "carry", amount: carry });
  return { lines: after, balance: round(after.reduce((sum, l) => sum + l.amount, 0)), since };
}
