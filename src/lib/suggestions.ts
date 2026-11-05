/**
 * Rule-based suggestions from transactions: no AI, just Israeli merchant names and patterns.
 * Pure so it can be tested; the server feeds it rows and drops dismissed keys.
 */

export interface SuggestionTxn {
  date: string;
  description: string;
  /** Negative for money out. */
  amount: number;
  kind: "expense" | "income" | string;
  categoryName?: string | null;
}

export type Suggestion =
  | { key: string; type: "policy"; name: string; policyKind: PolicyGuess; monthly: number }
  | { key: string; type: "debt"; name: string; debtType: "mortgage" | "loan"; monthly: number }
  | { key: string; type: "portfolio"; name: string; monthly: number }
  | { key: string; type: "fees"; yearly: number; count: number }
  | { key: string; type: "interest"; yearly: number }
  | { key: string; type: "fx"; yearly: number }
  | { key: string; type: "duplicate"; name: string; amount: number; date: string }
  | { key: string; type: "price"; name: string; from: number; to: number }
  | { key: string; type: "payday"; day: number };

export type PolicyGuess = "health" | "life" | "disability" | "long_term_care" | "home" | "car" | "travel" | "other";

const INSURER = /הראל|מגדל|כלל ביטוח|כלל חברה|הפניקס|מנורה|איילון|ביטוח ישיר|9 מיליון|ליברה|שלמה ביטוח|הכשרה|שירביט|ווישור|aig|harel|migdal|clal|phoenix|menora|ayalon|wesure|libra/i;
const POLICY_KIND: [RegExp, PolicyGuess][] = [
  [/סיעוד/i, "long_term_care"],
  [/אובדן כושר|א\.כ\.ע/i, "disability"],
  [/חיים|ריסק|risk|life/i, "life"],
  [/רכב|מקיף|חובה|car|auto/i, "car"],
  [/דירה|מבנה|תכולה|משכנתא|home/i, "home"],
  [/נסיע|travel/i, "travel"],
  [/בריאות|health/i, "health"],
];
const MORTGAGE = /משכנתא|משכנתה|mortgage/i;
const LOAN = /הלוואה|הלוואת|החזר הלו|loan/i;
const BROKER = /אקסלנס|מיטב|פסגות|אי\.?בי\.?אי|ibi|אינטראקטיב|interactive|בלינק|blink|excellence|meitav|psagot/i;
const BANK_FEE = /עמלת|עמלה|דמי ניהול חשבון|דמי כרטיס|דמי טיפול|commission/i;
const OVERDRAFT = /ריבית חובה|ריבית על יתרת חובה|ריבית בגין|ריבית משיכת יתר/i;
const FX_FEE = /עמלת המרה|עמלת מט"ח|עמלת חו"ל|עסקה בחו"ל|foreign transaction/i;

const month = (d: string) => d.slice(0, 7);
const clean = (s: string) => s.replace(/\s+/g, " ").replace(/[0-9]{4,}/g, "").trim();

/** Charges that repeat in at least `minMonths` different months: name -> average per charging month. */
function recurringBy(txns: SuggestionTxn[], match: RegExp, minMonths = 2) {
  const groups = new Map<string, { months: Set<string>; total: number }>();
  for (const t of txns) {
    if (t.amount >= 0 || !match.test(t.description)) continue;
    const name = clean(t.description);
    const g = groups.get(name) ?? { months: new Set(), total: 0 };
    g.months.add(month(t.date));
    g.total += -t.amount;
    groups.set(name, g);
  }
  return [...groups.entries()]
    .filter(([, g]) => g.months.size >= minMonths)
    .map(([name, g]) => ({ name, monthly: g.total / g.months.size }));
}

/** Sum of matching money-out over the last 12 months, scaled to a year from the months seen. */
function yearlySum(txns: SuggestionTxn[], match: RegExp, today: string) {
  const since = `${Number(today.slice(0, 4)) - 1}${today.slice(4)}`;
  const rows = txns.filter((t) => t.amount < 0 && t.date > since && match.test(t.description));
  return { total: rows.reduce((s, t) => s - t.amount, 0), count: rows.length };
}

export interface SuggestionContext {
  today: string;
  /** Lower-cased names of policies and assets already entered, to skip what is already there. */
  known: string[];
  monthStartDay: number;
  priceChanges: { merchant: string; from: number; to: number }[];
}

export function buildSuggestions(txns: SuggestionTxn[], ctx: SuggestionContext): Suggestion[] {
  const out: Suggestion[] = [];
  const isKnown = (name: string) => ctx.known.some((k) => k && (name.toLowerCase().includes(k) || k.includes(name.toLowerCase())));

  for (const r of recurringBy(txns, INSURER)) {
    if (isKnown(r.name)) continue;
    const policyKind = POLICY_KIND.find(([re]) => re.test(r.name))?.[1] ?? "other";
    out.push({ key: `policy:${r.name}`, type: "policy", name: r.name, policyKind, monthly: r.monthly });
  }
  for (const r of recurringBy(txns, new RegExp(`${MORTGAGE.source}|${LOAN.source}`, "i"))) {
    if (isKnown(r.name)) continue;
    out.push({ key: `debt:${r.name}`, type: "debt", name: r.name, debtType: MORTGAGE.test(r.name) ? "mortgage" : "loan", monthly: r.monthly });
  }
  for (const r of recurringBy(txns, BROKER)) {
    if (isKnown(r.name)) continue;
    out.push({ key: `portfolio:${r.name}`, type: "portfolio", name: r.name, monthly: r.monthly });
  }

  const year = ctx.today.slice(0, 4);
  const fees = yearlySum(txns, BANK_FEE, ctx.today);
  if (fees.total >= 60) out.push({ key: `fees:${year}`, type: "fees", yearly: fees.total, count: fees.count });
  const interest = yearlySum(txns, OVERDRAFT, ctx.today);
  if (interest.total > 0) out.push({ key: `interest:${year}`, type: "interest", yearly: interest.total });
  const fx = yearlySum(txns, FX_FEE, ctx.today);
  if (fx.total >= 30) out.push({ key: `fx:${year}`, type: "fx", yearly: fx.total });

  // Same merchant and amount twice within a day, in the last 60 days.
  const recent = txns
    .filter((t) => t.amount < 0 && daysBetween(t.date, ctx.today) <= 60)
    .sort((a, b) => a.date.localeCompare(b.date));
  for (let i = 1; i < recent.length; i++) {
    for (let j = i - 1; j >= 0 && daysBetween(recent[j].date, recent[i].date) <= 1; j--) {
      const a = recent[j], b = recent[i];
      if (a.amount === b.amount && clean(a.description) === clean(b.description)) {
        out.push({ key: `duplicate:${b.date}:${clean(b.description)}:${b.amount}`, type: "duplicate", name: clean(b.description), amount: -b.amount, date: b.date });
        break;
      }
    }
  }

  for (const p of ctx.priceChanges) {
    out.push({ key: `price:${p.merchant}:${p.to}`, type: "price", name: p.merchant, from: p.from, to: p.to });
  }

  // Salary day: the most common day salary lands, if months still start on the 1st.
  if (ctx.monthStartDay === 1) {
    const salary = txns.filter((t) => t.kind === "income" && t.amount > 0 && /salary|משכורת/i.test(`${t.categoryName ?? ""} ${t.description}`));
    const days = new Map<number, number>();
    for (const t of salary) {
      const d = Math.min(28, Number(t.date.slice(8, 10)));
      days.set(d, (days.get(d) ?? 0) + 1);
    }
    const [day, n] = [...days.entries()].sort((a, b) => b[1] - a[1])[0] ?? [1, 0];
    if (n >= 3 && day > 3) out.push({ key: `payday:${day}`, type: "payday", day });
  }
  return out;
}

function daysBetween(a: string, b: string) {
  return Math.abs((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86_400_000);
}
