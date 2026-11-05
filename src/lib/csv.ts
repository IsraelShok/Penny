/** Minimal CSV parser: quoted fields, escaped quotes, CRLF, and ; or tab delimiters (picked from the header). */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const header = clean.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = [",", ";", "\t"].sort((a, b) => header.split(b).length - header.split(a).length)[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      row.push(field.trim());
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(field.trim());
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  row.push(field.trim());
  if (row.some((f) => f !== "")) rows.push(row);
  return rows;
}

/** "₪1,234.50" / "1 234,5" / "(12)" -> number, or null. */
export function parseAmount(s: string | undefined): number | null {
  if (!s) return null;
  let t = s.replace(/[^\d.,()\-]/g, "");
  const negative = /^\(.*\)$/.test(t) || t.startsWith("-");
  t = t.replace(/[()\-]/g, "");
  // A comma followed by exactly 1-2 digits at the end is a decimal comma.
  t = /,\d{1,2}$/.test(t) ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  const n = Number(t);
  return t && Number.isFinite(n) ? (negative ? -n : n) : null;
}
