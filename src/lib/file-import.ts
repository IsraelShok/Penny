import { parseAmount } from "@/lib/csv";

/** Bank / credit-card statement import: header detection, column mapping and row parsing. */
export const IMPORT_FIELDS = ["date", "description", "amount", "debit", "credit"] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];
export type ImportMap = Record<ImportField, number | null>;
export interface ImportRow { date: string; description: string; amount: number }
export const MAX_IMPORT_ROWS = 5000;

// Most specific first: the first keyword that matches a column wins for that field.
const KEYWORDS: Record<ImportField, string[]> = {
  date: ["תאריך עסקה", "תאריך רכישה", "תאריך", "תאריך ערך", "תאריך חיוב", "date", "transaction date"],
  description: ["שם בית העסק", "בית עסק", "שם בית עסק", "תיאור", "תאור", "תיאור התנועה", "פרטים", "description", "merchant", "details"],
  amount: ["סכום חיוב", "סכום החיוב", "סכום", "סכום עסקה", "סכום העסקה", "amount", "charge amount"],
  debit: ["חובה", "בחובה", "debit"],
  credit: ["זכות", "בזכות", "credit"],
};
const HEADER_WORDS = [...Object.values(KEYWORDS).flat(), "יתרה", "balance"];

const norm = (s: string) => s.replace(/[\s"'׳״:*()₪]+/g, " ").trim().toLowerCase();

/** Index of the header row: the row among the first 30 with the most known column names (at least 2), or -1. */
export function findHeaderRow(table: string[][]): number {
  let best = -1;
  let bestHits = 1;
  table.slice(0, 30).forEach((row, i) => {
    const hits = row.filter((c) => {
      const n = norm(c);
      return n && HEADER_WORDS.some((k) => n === k || (n.length <= 30 && n.includes(k)));
    }).length;
    if (hits > bestHits) { best = i; bestHits = hits; }
  });
  return best;
}

export function guessColumns(header: string[]): ImportMap {
  const cols = header.map(norm);
  const used = new Set<number>();
  const map = {} as ImportMap;
  for (const f of IMPORT_FIELDS) {
    let found: number | null = null;
    for (const k of KEYWORDS[f]) {
      const exact = cols.findIndex((c, i) => !used.has(i) && c === k);
      const loose = exact >= 0 ? exact : cols.findIndex((c, i) => !used.has(i) && c.includes(k) && !c.includes("יתרה"));
      if (loose >= 0) { found = loose; break; }
    }
    if (found != null) used.add(found);
    map[f] = found;
  }
  // "סכום חובה" style headers: separate debit/credit columns win over a single amount.
  if (map.debit != null && map.credit != null && map.amount != null && [map.debit, map.credit].includes(map.amount)) map.amount = null;
  return map;
}

const iso = (y: number, m: number, d: number) => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? dt.toISOString().slice(0, 10) : null;
};

/** dd/mm/yyyy, dd.mm.yy, dd-mm-yyyy, yyyy-mm-dd or an Excel date serial -> "yyyy-mm-dd", or null. */
export function parseImportDate(s: string | undefined): string | null {
  const t = (s ?? "").trim();
  if (/^\d{5}(\.\d+)?$/.test(t)) {
    const n = Math.floor(Number(t));
    if (n < 20000 || n > 80000) return null;
    return new Date(Date.UTC(1899, 11, 30) + n * 86_400_000).toISOString().slice(0, 10);
  }
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})\b/.exec(t);
  if (!m) return null;
  const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
  return iso(y, +m[2], +m[1]);
}

/**
 * Turns body rows into transactions (negative = money out). A single amount column on a card
 * statement lists spending as positive, so `positiveIsExpense` flips it.
 */
export function buildImportRows(body: string[][], map: ImportMap, positiveIsExpense: boolean): { rows: ImportRow[]; skipped: number } {
  const rows: ImportRow[] = [];
  let skipped = 0;
  for (const r of body) {
    const date = map.date == null ? null : parseImportDate(r[map.date]);
    const description = map.description == null ? "" : (r[map.description] ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
    let amount: number | null = null;
    if (map.amount != null) {
      const a = parseAmount(r[map.amount]);
      amount = a == null ? null : positiveIsExpense ? -a : a;
    } else if (map.debit != null || map.credit != null) {
      const d = map.debit == null ? null : parseAmount(r[map.debit]);
      const c = map.credit == null ? null : parseAmount(r[map.credit]);
      amount = d == null && c == null ? null : (c ?? 0) - Math.abs(d ?? 0);
    }
    if (!date || !description || amount == null || amount === 0) { skipped++; continue; }
    rows.push({ date, description, amount: Math.round(amount * 100) / 100 });
  }
  return { rows, skipped };
}

export const importKey = (r: ImportRow) => `${r.date}|${r.amount}|${r.description}`;

/**
 * Marks rows already stored for this account. `existing` counts stored rows per importKey; the
 * n-th identical row in the file is a duplicate only if at least n are already stored, so two
 * real coffees on the same day both survive. `seq` is that occurrence number (for dedup_sequence).
 */
export function markDuplicates(rows: ImportRow[], existing: Map<string, number>) {
  const seen = new Map<string, number>();
  return rows.map((r) => {
    const k = importKey(r);
    const seq = (seen.get(k) ?? 0) + 1;
    seen.set(k, seq);
    return { ...r, seq, duplicate: seq <= (existing.get(k) ?? 0) };
  });
}
