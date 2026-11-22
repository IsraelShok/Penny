/** "import from any text": what the AI hands back, checked, and turned into a table the sheet import reads. */
export interface ExtractedRow {
  /** YYYY-MM-DD */
  date: string;
  description: string;
  /** Always positive; `kind` says which way the money went. */
  amount: number;
  kind: "expense" | "income";
}

export const MAX_TEXT_IMPORT = 20_000;

/** The instructions for the model that reads a statement (pasted text, a PDF's text or an image). */
export const EXTRACT_SYSTEM = `You read a bank or card statement, a receipt, or any pasted text, and list the money movements in it.
Reply with ONLY a JSON array, no prose. Each item: {"date":"YYYY-MM-DD","description":"merchant or payee as written","amount":number,"kind":"expense"|"income"}.
amount is positive; kind says the direction. Dates without a year are in the current year. Skip balances, totals and headers.
If there are no movements, reply [].`;
const MAX_ROWS = 500;

/** Keeps the well-formed rows from a model's reply, which may wrap the JSON array in prose or a code fence. */
export function parseExtractedRows(raw: string): ExtractedRow[] {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const out: ExtractedRow[] = [];
  for (const r of data) {
    if (!r || typeof r !== "object") continue;
    const { date, description, amount, kind } = r as Record<string, unknown>;
    const n =
      typeof amount === "number" ? amount : Number(String(amount ?? "").replace(/[,₪\s]/g, ""));
    if (
      typeof date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      Number.isNaN(Date.parse(date))
    )
      continue;
    if (typeof description !== "string" || !description.trim() || !Number.isFinite(n) || n === 0)
      continue;
    const k =
      kind === "income" ? "income" : kind === "expense" ? "expense" : n < 0 ? "expense" : "income";
    out.push({ date, description: description.trim().slice(0, 120), amount: Math.abs(n), kind: k });
    if (out.length >= MAX_ROWS) break;
  }
  return out;
}

/** The image type from the file's first bytes (names and browser types lie), or null when it is not an image a model reads. */
export function sniffImageType(
  b: Uint8Array,
): "image/jpeg" | "image/png" | "image/gif" | "image/webp" | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "image/gif";
  if (
    String.fromCharCode(...b.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...b.slice(8, 12)) === "WEBP"
  )
    return "image/webp";
  return null;
}

/** The rows as a pasted sheet: a header the column guesser knows, then one line per row. */
export function extractedToTable(rows: ExtractedRow[]): string[][] {
  return [
    ["date", "description", "amount", "type"],
    ...rows.map((r) => [r.date, r.description, String(r.amount), r.kind]),
  ];
}
