/**
 * Phone capture: turns what a phone automation or a bank text sends into manual-transaction input.
 * Pure, so it is tested without a server.
 */

export interface CapturedCharge {
  amount: number;
  description: string;
  date: string; // YYYY-MM-DD
  last4?: string;
}

/** "1,234.50", "12,5", 12 → number; anything else → null. */
export function parseAmount(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  let s = raw.trim().replace(/[₪\s]|ש["״']?ח|ILS/g, "");
  // A lone comma with 1–2 digits after it is a decimal comma (phone keypads); otherwise commas group thousands.
  s = /^\d+,\d{1,2}$/.test(s) ? s.replace(",", ".") : s.replace(/,/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

/** Body of POST /api/quick-add → input for createManualTransaction (which still validates every field). */
export function quickAddInput(body: unknown, today: string) {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const amount = parseAmount(b.amount);
  const income = b.kind === "income";
  return {
    kind: income ? ("income" as const) : ("expense" as const),
    amount: amount === null ? b.amount : Math.abs(amount),
    description: typeof b.description === "string" ? b.description.trim() : b.description,
    date: b.date === undefined || b.date === "" ? today : b.date,
    ...(b.account === undefined || b.account === "" ? {} : { account: b.account }),
  };
}

const norm = (text: string) =>
  text
    .replace(/[״”“]/g, '"')
    .replace(/[‎‏‪-‮]/g, "")
    .replace(/[־–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

const AMOUNT =
  /(?:בסך|בסכום(?: של)?|סכום)\s*:?\s*(?:₪\s*)?(\d[\d,]*(?:\.\d{1,2})?)\s*(ש"ח|₪|ILS|שקלים|\$|USD|€|EUR)?/;
const LAST4 = /(?:המסתיים|מסתיים|בספרות|כרטיס(?:ך|כם)?)\s*(?:ב\s*-?\s*|:\s*)?(\d{4})(?!\d)/;
// Where the merchant name stops: the next clause of the message.
const STOP = String.raw`(?=\s+(?:בסך|בסכום|סכום|בתאריך|בכרטיס|אושר|בוצע|ביום|לפרטים)|[.,](?!\d)|\n|$)`;
const MERCHANT = [
  new RegExp(String.raw`(?:בבית ה?עסק|אצל|בעסק)\s*:?\s*-?\s*(.+?)${STOP}`),
  new RegExp(String.raw`(?:עסקה|רכישה)\s+ב-\s*(.+?)${STOP}`),
  new RegExp(String.raw`\sב-\s*([^\d\s].*?)${STOP}`),
];
const TRIGGER = /עסק[הא]|חוי?ב|חיוב|רכישה|אושר/;

/** Date in the text (dd/mm[/yy]), or today. A dd/mm later than today is last year's. */
function smsDate(text: string, today: string): string {
  const m = text.match(/(?<!\d)(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?(?!\d)/);
  if (!m) return today;
  const [day, month] = [Number(m[1]), Number(m[2])];
  if (day < 1 || day > 31 || month < 1 || month > 12) return today;
  let year = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : Number(today.slice(0, 4));
  const iso = (y: number) =>
    `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (!m[3] && iso(year) > today) year -= 1;
  return iso(year);
}

/**
 * Reads a card-charge text message from an Israeli bank or card company. Tolerant of wording:
 * needs a charge keyword, a shekel amount and a merchant; null otherwise (foreign currency too:
 * the shekel amount arrives with the bank sync).
 */
export function parseBankSms(raw: string, today: string): CapturedCharge | null {
  const text = norm(raw);
  if (text.startsWith("/") || !TRIGGER.test(text)) return null;
  const a = text.match(AMOUNT);
  if (!a) return null;
  if (a[2] && !/ש"ח|₪|ILS|שקלים/.test(a[2])) return null;
  const amount = parseAmount(a[1]);
  if (!amount || amount <= 0) return null;
  let description: string | undefined;
  for (const re of MERCHANT) {
    const m = text.match(re)?.[1]?.trim();
    if (m && !/^\d/.test(m) && m.length <= 60) {
      description = m.replace(/^["']|["']$/g, "").trim();
      break;
    }
  }
  if (!description) return null;
  const last4 = text.match(LAST4)?.[1];
  return {
    amount,
    description,
    date: smsDate(text.replace(a[0], " "), today),
    ...(last4 ? { last4 } : {}),
  };
}

/**
 * At most `limit` adds per device in any `windowMs`: a leaked key can't flood the ledger before it is revoked.
 * `hits` is the caller's per-device memory (a restart forgets it, which only loosens the limit once).
 */
export function underRateLimit(
  hits: Map<number, number[]>,
  device: number,
  now: number,
  limit = 20,
  windowMs = 60_000,
): boolean {
  const recent = (hits.get(device) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(device, recent);
    return false;
  }
  hits.set(device, [...recent, now]);
  return true;
}
