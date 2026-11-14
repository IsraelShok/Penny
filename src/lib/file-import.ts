import { parseAmount, parseCsv } from "@/lib/csv";
import { readXlsx } from "@/lib/xlsx";

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

const headerHits = (row: string[]) =>
  row.filter((c) => {
    const n = norm(c);
    return n && HEADER_WORDS.some((k) => n === k || (n.length <= 30 && n.includes(k)));
  }).length;

/** Index of the first header row (at least 2 known column names) among the first 30, or -1. Later sections have their own header. */
export function findHeaderRow(table: string[][]): number {
  return table.slice(0, 30).findIndex((row) => headerHits(row) >= 2);
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
 * statement lists spending as positive, so `positiveIsExpense` flips it. A later header row
 * (card exports list domestic, then abroad, each with its own header) re-maps the columns below it.
 */
export function buildImportRows(body: string[][], map: ImportMap, positiveIsExpense: boolean): { rows: ImportRow[]; skipped: number } {
  const rows: ImportRow[] = [];
  let skipped = 0;
  for (const r of body) {
    if (headerHits(r) >= 2) { map = guessColumns(r); continue; }
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

/**
 * Rows of every <table> in an HTML page. Some Israeli banks download "Excel" files that are
 * really HTML tables saved with an .xls name.
 */
// shortcut: regex parsing, no nested tables or rowspan; fine for bank exports, switch to DOMParser if one breaks.
export function parseHtmlTable(html: string): string[][] {
  const text = (s: string) =>
    s.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
      .replace(/\s+/g, " ").trim();
  const rows: string[][] = [];
  for (const tr of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row: string[] = [];
    for (const td of tr[1].matchAll(/<t([dh])\b([^>]*)>([\s\S]*?)<\/t\1>/gi)) {
      row.push(text(td[3]));
      for (let k = Number(/colspan="?(\d+)/i.exec(td[2])?.[1] ?? 1); k > 1; k--) row.push("");
    }
    if (row.some((c) => c)) rows.push(row);
  }
  return rows;
}

/** The file types the reader below understands; the import guide's table and the file picker come from this list. */
export const IMPORT_FORMATS = [
  { ext: ".csv", label: "CSV", note: "csv" },
  { ext: ".xlsx", label: "Excel (xlsx)", note: "xlsx" },
  { ext: ".xls", label: "Excel (xls)", note: "xls" },
] as const;
export const IMPORT_EXTS: readonly string[] = IMPORT_FORMATS.map((f) => f.ext);

/** Raw rows of a statement file. Throws "xlsNotSupported" for a real legacy binary .xls. */
export async function readStatementTable(bytes: Uint8Array, name: string): Promise<string[][]> {
  // Some .xls downloads are really .xlsx; check the zip signature, not the name.
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return readXlsx(bytes);
  // Israeli bank CSVs are often Windows-1255, not UTF-8.
  let text = new TextDecoder("utf-8").decode(bytes);
  if (text.includes("�")) text = new TextDecoder("windows-1255").decode(bytes);
  if (/<table/i.test(text)) return parseHtmlTable(text);
  if (name.toLowerCase().endsWith(".xls")) throw new Error("xlsNotSupported");
  return parseCsv(text);
}

/** File → transactions with the auto-detected columns (the unattended folder import). Throws "noHeader". */
export async function statementRows(bytes: Uint8Array, name: string, positiveIsExpense = true) {
  const table = await readStatementTable(bytes, name);
  const h = findHeaderRow(table);
  if (h < 0) throw new Error("noHeader");
  return buildImportRows(table.slice(h + 1), guessColumns(table[h]), positiveIsExpense);
}
