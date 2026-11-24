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
  | { key: string; type: "payday"; day: number }
  | {
      key: string;
      type: "rule";
      merchant: string;
      categoryId: number;
      categoryName: string;
      count: number;
    }
  | { key: string; type: "fxMarkup"; total: number; avgPct: number; count: number }
  | { key: string; type: "leak"; name: string; count: number; monthly: number }
  | {
      key: string;
      type: "taxRefund";
      year: number;
      reason: "twoEmployers" | "gap";
      payers: number;
      months: number;
    }
  | { key: string; type: "spike"; category: string; current: number; avg: number; pct: number }
  | { key: string; type: "emergency"; months: number; target: number }
  | { key: string; type: "idle"; amount: number; buffer: number };

type PolicyGuess =
  "health" | "life" | "disability" | "long_term_care" | "home" | "car" | "travel" | "other";

const INSURER =
  /הראל|מגדל|כלל ביטוח|כלל חברה|הפניקס|מנורה|איילון|ביטוח ישיר|9 מיליון|ליברה|שלמה ביטוח|הכשרה|שירביט|ווישור|aig|harel|migdal|clal|phoenix|menora|ayalon|wesure|libra/i;
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
const BROKER =
  /אקסלנס|מיטב|פסגות|אי\.?בי\.?אי|ibi|אינטראקטיב|interactive|בלינק|blink|excellence|meitav|psagot/i;
const BANK_FEE = /עמלת|עמלה|דמי ניהול חשבון|דמי כרטיס|דמי טיפול|commission/i;
const OVERDRAFT = /ריבית חובה|ריבית על יתרת חובה|ריבית בגין|ריבית משיכת יתר/i;
const FX_FEE = /עמלת המרה|עמלת מט"ח|עמלת חו"ל|עסקה בחו"ל|foreign transaction/i;

const LEAK_MAX = 60;
const LEAK_MIN_COUNT = 6;
const month = (d: string) => d.slice(0, 7);
const clean = (s: string) =>
  s
    .replace(/\s+/g, " ")
    .replace(/[0-9]{4,}/g, "")
    .trim();

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
  /** Merchants the user keeps moving to the same category, with no rule for them yet. */
  ruleCandidates?: { merchant: string; categoryId: number; categoryName: string; count: number }[];
  /** Conversion markup over the market rate on foreign card charges, last 12 months. */
  fxMarkup?: { total: number; avgPct: number; count: number } | null;
  /** From taxYearFacts: salary patterns per past tax year. */
  taxYears?: TaxYearFacts[];
  /** Cash, deposits and money-market funds on hand (emergency fund). */
  liquid?: number;
  /** Synced checking balances, summed. */
  checking?: number;
}

export interface TaxYearFacts {
  year: number;
  /** Distinct employers paying salary in at least two months. */
  payers: number;
  /** Months with any salary. */
  salaryMonths: number;
  /** Transactions exist in both January and December, so missing months are real, not missing data. */
  fullYear: boolean;
}

/**
 * Salary patterns per completed tax year, for the refund hint. `rows` are salary credits;
 * `months` lists every YYYY-MM that has any transaction. Only the years a refund can still be claimed.
 */
export function taxYearFacts(
  rows: { date: string; description: string }[],
  months: string[],
  today: string,
  yearsBack = 6,
): TaxYearFacts[] {
  const now = Number(today.slice(0, 4));
  const out: TaxYearFacts[] = [];
  for (let year = now - yearsBack; year < now; year++) {
    const inYear = rows.filter((r) => r.date.startsWith(`${year}-`));
    if (inYear.length === 0) continue;
    const byPayer = new Map<string, Set<string>>();
    for (const r of inYear) {
      const payer = clean(r.description);
      byPayer.set(payer, (byPayer.get(payer) ?? new Set()).add(month(r.date)));
    }
    out.push({
      year,
      payers: [...byPayer.values()].filter((m) => m.size >= 2).length,
      salaryMonths: new Set(inYear.map((r) => month(r.date))).size,
      fullYear: months.includes(`${year}-01`) && months.includes(`${year}-12`),
    });
  }
  return out;
}

/** Rough yearly ₪ at stake, so the feed leads with what matters most. Setup items (add a policy, a rule) trail. */
function impact(s: Suggestion): number {
  switch (s.type) {
    case "emergency":
      return 20_000 * (1 - s.months / 3);
    case "interest":
      return s.yearly * 2; // debt interest compounds: first in line
    case "fees":
    case "fx":
      return s.yearly;
    case "fxMarkup":
      return s.total;
    case "duplicate":
      return s.amount;
    case "price":
      return (s.to - s.from) * 12;
    case "leak":
      return s.monthly * 12;
    case "spike":
      return (s.current - s.avg) * 3;
    case "idle":
      return s.amount * 0.04; // what a money-market fund would earn
    case "taxRefund":
      return 3_000;
    default:
      return 1;
  }
}

/** Spending, emergency-fund and idle-cash insights on the user's own numbers. */
function moneyInsights(txns: SuggestionTxn[], ctx: SuggestionContext): Suggestion[] {
  const out: Suggestion[] = [];
  const thisMonth = ctx.today.slice(0, 7);
  const prev = [1, 2, 3].map((n) => {
    const d = new Date(`${thisMonth}-15T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - n);
    return d.toISOString().slice(0, 7);
  });
  const spend = (m: string, cat?: string) =>
    txns
      .filter(
        (t) =>
          t.amount < 0 &&
          t.kind === "expense" &&
          month(t.date) === m &&
          (cat === undefined || t.categoryName === cat),
      )
      .reduce((s, t) => s - t.amount, 0);
  const hasData = prev.every((m) => txns.some((t) => month(t.date) === m));
  if (!hasData) return out;

  // A category already 30%+ (and ₪200+) above its 3-month average, this month so far.
  const cats = new Set(
    txns.filter((t) => t.categoryName && month(t.date) === thisMonth).map((t) => t.categoryName!),
  );
  for (const c of cats) {
    const current = spend(thisMonth, c);
    const avg = prev.reduce((s, m) => s + spend(m, c), 0) / 3;
    if (avg >= 100 && current >= avg * 1.3 && current - avg >= 200) {
      out.push({
        key: `spike:${thisMonth}:${c}`,
        type: "spike",
        category: c,
        current,
        avg,
        pct: Math.round((current / avg - 1) * 100),
      });
    }
  }

  const expenses = prev.reduce((s, m) => s + spend(m), 0) / 3;
  if (expenses <= 0) return out;
  if (ctx.liquid !== undefined) {
    const months = Math.round((ctx.liquid / expenses) * 10) / 10;
    if (months < 3)
      out.push({ key: `emergency:${thisMonth}`, type: "emergency", months, target: expenses * 3 });
  }
  // Checking above a one-month buffer earns nothing; only worth saying from ₪5,000.
  if (ctx.checking !== undefined) {
    const amount = Math.floor((ctx.checking - expenses) / 100) * 100;
    if (amount >= 5_000)
      out.push({ key: `idle:${thisMonth}`, type: "idle", amount, buffer: expenses });
  }
  return out;
}

export function buildSuggestions(txns: SuggestionTxn[], ctx: SuggestionContext): Suggestion[] {
  return [...rawSuggestions(txns, ctx), ...moneyInsights(txns, ctx)].sort(
    (a, b) => impact(b) - impact(a),
  );
}

function rawSuggestions(txns: SuggestionTxn[], ctx: SuggestionContext): Suggestion[] {
  const out: Suggestion[] = [];
  const isKnown = (name: string) =>
    ctx.known.some((k) => k && (name.toLowerCase().includes(k) || k.includes(name.toLowerCase())));

  for (const r of recurringBy(txns, INSURER)) {
    if (isKnown(r.name)) continue;
    const policyKind = POLICY_KIND.find(([re]) => re.test(r.name))?.[1] ?? "other";
    out.push({
      key: `policy:${r.name}`,
      type: "policy",
      name: r.name,
      policyKind,
      monthly: r.monthly,
    });
  }
  for (const r of recurringBy(txns, new RegExp(`${MORTGAGE.source}|${LOAN.source}`, "i"))) {
    if (isKnown(r.name)) continue;
    out.push({
      key: `debt:${r.name}`,
      type: "debt",
      name: r.name,
      debtType: MORTGAGE.test(r.name) ? "mortgage" : "loan",
      monthly: r.monthly,
    });
  }
  for (const r of recurringBy(txns, BROKER)) {
    if (isKnown(r.name)) continue;
    out.push({ key: `portfolio:${r.name}`, type: "portfolio", name: r.name, monthly: r.monthly });
  }

  const year = ctx.today.slice(0, 4);
  const fees = yearlySum(txns, BANK_FEE, ctx.today);
  if (fees.total >= 60)
    out.push({ key: `fees:${year}`, type: "fees", yearly: fees.total, count: fees.count });
  const interest = yearlySum(txns, OVERDRAFT, ctx.today);
  if (interest.total > 0)
    out.push({ key: `interest:${year}`, type: "interest", yearly: interest.total });
  const fx = yearlySum(txns, FX_FEE, ctx.today);
  if (fx.total >= 30) out.push({ key: `fx:${year}`, type: "fx", yearly: fx.total });

  // Same merchant and amount twice within a day, in the last 60 days.
  const recent = txns
    .filter((t) => t.amount < 0 && daysBetween(t.date, ctx.today) <= 60)
    .sort((a, b) => a.date.localeCompare(b.date));
  for (let i = 1; i < recent.length; i++) {
    for (let j = i - 1; j >= 0 && daysBetween(recent[j].date, recent[i].date) <= 1; j--) {
      const a = recent[j],
        b = recent[i];
      if (a.amount === b.amount && clean(a.description) === clean(b.description)) {
        out.push({
          key: `duplicate:${b.date}:${clean(b.description)}:${b.amount}`,
          type: "duplicate",
          name: clean(b.description),
          amount: -b.amount,
          date: b.date,
        });
        break;
      }
    }
  }

  // Small, frequent charges ("leaks": coffee, snacks, rides): 6+ charges of up to ₪60 at one merchant in 30 days.
  const small = new Map<string, { count: number; total: number }>();
  for (const t of txns) {
    if (t.amount >= 0 || -t.amount > LEAK_MAX || daysBetween(t.date, ctx.today) > 30) continue;
    const name = clean(t.description);
    const g = small.get(name) ?? { count: 0, total: 0 };
    g.count++;
    g.total -= t.amount;
    small.set(name, g);
  }
  for (const [name, g] of small) {
    if (g.count >= LEAK_MIN_COUNT)
      out.push({
        key: `leak:${ctx.today.slice(0, 7)}:${name}`,
        type: "leak",
        name,
        count: g.count,
        monthly: g.total,
      });
  }

  for (const p of ctx.priceChanges) {
    out.push({
      key: `price:${p.merchant}:${p.to}`,
      type: "price",
      name: p.merchant,
      from: p.from,
      to: p.to,
    });
  }

  for (const r of ctx.ruleCandidates ?? []) {
    if (r.count >= 2) out.push({ key: `rule:${r.merchant}:${r.categoryId}`, type: "rule", ...r });
  }
  if (ctx.fxMarkup && ctx.fxMarkup.total >= 20 && ctx.fxMarkup.avgPct >= 0.5) {
    out.push({ key: `fxMarkup:${year}`, type: "fxMarkup", ...ctx.fxMarkup });
  }

  // Salary day: the most common day salary lands, if months still start on the 1st.
  if (ctx.monthStartDay === 1) {
    const salary = txns.filter(
      (t) =>
        t.kind === "income" &&
        t.amount > 0 &&
        /salary|משכורת/i.test(`${t.categoryName ?? ""} ${t.description}`),
    );
    const days = new Map<number, number>();
    for (const t of salary) {
      const d = Math.min(28, Number(t.date.slice(8, 10)));
      days.set(d, (days.get(d) ?? 0) + 1);
    }
    const [day, n] = [...days.entries()].sort((a, b) => b[1] - a[1])[0] ?? [1, 0];
    if (n >= 3 && day > 3) out.push({ key: `payday:${day}`, type: "payday", day });
  }
  // Two employers in a year, or months without salary, often mean too much tax was withheld (form 135).
  for (const y of ctx.taxYears ?? []) {
    const reason =
      y.payers >= 2
        ? "twoEmployers"
        : y.fullYear && y.salaryMonths >= 3 && y.salaryMonths <= 10
          ? "gap"
          : null;
    if (reason)
      out.push({
        key: `taxRefund:${y.year}`,
        type: "taxRefund",
        year: y.year,
        reason,
        payers: y.payers,
        months: y.salaryMonths,
      });
  }
  return out;
}

function daysBetween(a: string, b: string) {
  return Math.abs((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86_400_000);
}
