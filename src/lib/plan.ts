/** Advisor checks on top of net worth: fees, debts, goals, allocation. Pure functions so they can be tested. */

/**
 * Typical competitive fees in Israel (% a year), used as the "market" comparison. Rough reference points,
 * not quotes: pension from deposit and balance, study and provident funds on balance only.
 */
// Pension: the level of the default ('kranot bererat mechdal') funds, about 1% / 0.22%. Study/provident: a typical competitive level. Caps are in il-defaults.
export const BENCHMARK_FEES: Record<string, { deposit: number; balance: number }> = {
  pension: { deposit: 1, balance: 0.22 },
  study_fund: { deposit: 0, balance: 0.6 },
  provident: { deposit: 0, balance: 0.6 },
};

/** Balance after `years` with monthly deposits, given yearly gross return and fees in percent. */
export function projectBalance(balance: number, monthlyDeposit: number, years: number, grossReturn: number, feeDepositPct: number, feeBalancePct: number): number {
  const monthly = Math.pow(1 + grossReturn - feeBalancePct / 100, 1 / 12) - 1;
  let b = balance;
  for (let m = 0; m < Math.round(years * 12); m++) b = b * (1 + monthly) + monthlyDeposit * (1 - feeDepositPct / 100);
  return b;
}

/** What your fees cost by retirement compared with benchmark fees (positive = you lose that much). */
export function feeCost(
  type: string,
  balance: number,
  monthlyDeposit: number,
  years: number,
  feeDepositPct: number,
  feeBalancePct: number,
  grossReturn = 0.05,
  /** Peer medians from the fund's public data, when the asset is linked to a fund. */
  peers?: { deposit: number; balance: number }
): { yours: number; benchmark: number; cost: number } | null {
  const bench = peers ?? BENCHMARK_FEES[type];
  if (!bench || years <= 0) return null;
  const yours = projectBalance(balance, monthlyDeposit, years, grossReturn, feeDepositPct, feeBalancePct);
  const benchmark = projectBalance(balance, monthlyDeposit, years, grossReturn, Math.min(feeDepositPct, bench.deposit), Math.min(feeBalancePct, bench.balance));
  return { yours, benchmark, cost: benchmark - yours };
}

/** Months to pay off a debt and the interest paid; null if the payment doesn't cover the interest. */
export function debtPayoff(balance: number, ratePct: number, payment: number): { months: number; interest: number } | null {
  const r = ratePct / 100 / 12;
  if (balance <= 0) return { months: 0, interest: 0 };
  if (payment <= balance * r) return null;
  let b = balance;
  let interest = 0;
  let months = 0;
  while (b > 0.005 && months < 1200) {
    const i = b * r;
    interest += i;
    b = b + i - payment;
    months++;
  }
  return { months, interest };
}

/** Monthly saving needed to reach a goal by its date (0 if already funded; the whole gap if the date has passed). */
export function goalMonthly(target: number, saved: number, targetDate: string, today: Date): number {
  const gap = target - saved;
  if (gap <= 0) return 0;
  const [y, m] = targetDate.split("-").map(Number);
  const months = (y - today.getFullYear()) * 12 + (m - 1 - today.getMonth());
  return months > 0 ? gap / months : gap;
}

export const ALLOCATION_CLASSES = ["equity", "bonds", "cash"] as const;
export type AllocationClass = (typeof ALLOCATION_CLASSES)[number];

/** Which liquid asset types count toward each class of the target allocation. */
export const CLASS_OF: Record<string, AllocationClass> = {
  stock: "equity", fund: "equity", crypto: "equity", metal: "equity", study_fund: "equity", provident: "equity",
  bond: "bonds",
  cash: "cash", deposit: "cash",
};

export interface FinancialPlan {
  /** Day of the month your month starts (salary or card bill day), 1-28. */
  monthStartDay: number;
  birthYear: number | null;
  retirementAge: number;
  emergencyMonths: number;
  allocation: Record<AllocationClass, number>;
  /** Yearly tax checklist, keyed by item, value = year last done. */
  taxDone: Record<string, number>;
  /** Hide advanced analysis and keep only the essentials. */
  simpleMode: boolean;
  /** Scrolling past a page's end opens the next page. Off by default: nothing should move by surprise. */
  wheelPaging: boolean;
  /** Weekly check-in: ISO week key of the last one done, and how many weeks in a row. */
  checkin: { lastWeek: string | null; streak: number };
  /** Life events for the FI projection (up to 12). */
  events: LifeEvent[];
  /** Optional "get to know you" answers; any field may stay null (skipped). */
  profile: UserProfile;
  /** Which Home to show: the new companion, or today's classic one. */
  homeStyle: HomeStyle;
}

export const HOME_STYLES = ["companion", "classic"] as const;
export type HomeStyle = (typeof HOME_STYLES)[number];

/** Existing users (onboarded or with data) keep today's Home; only brand-new ones get the companion. */
export function defaultHomeStyle(onboarded: boolean, hasTransactions: boolean): HomeStyle {
  return onboarded || hasTransactions ? "classic" : "companion";
}

/** A client plan without a valid homeStyle keeps the stored one instead of resetting to the default. */
export function keepHomeStyle(raw: unknown, stored: HomeStyle): HomeStyle {
  return pick(HOME_STYLES, (raw as { homeStyle?: unknown } | null)?.homeStyle) ?? stored;
}

export const SITUATIONS = ["student", "employee", "selfEmployed", "family", "retired"] as const;
export const GOALS = ["control", "save", "overdraft", "invest"] as const;
export const CONFIDENCE = ["beginner", "intermediate", "advanced"] as const;
export const DETAIL = ["simple", "standard", "detailed"] as const;

export interface UserProfile {
  situation: (typeof SITUATIONS)[number] | null;
  householdSize: number | null;
  goal: (typeof GOALS)[number] | null;
  /** What the user is saving for, when goal is "save". */
  goalNote: string;
  confidence: (typeof CONFIDENCE)[number] | null;
  detail: (typeof DETAIL)[number] | null;
  /** The intro was finished or skipped; it can still be reopened from More / Help. */
  onboarded: boolean;
}

export const EMPTY_PROFILE: UserProfile = { situation: null, householdSize: null, goal: null, goalNote: "", confidence: null, detail: null, onboarded: false };

/** The plan changes the answers drive: beginners or "simple" get simple mode, advanced or "detailed" get the full views. */
export function profileEffects(p: UserProfile): Partial<FinancialPlan> {
  const simple = p.detail === "simple" || (p.detail == null && p.confidence === "beginner");
  const dense = p.detail === "detailed" || (p.detail == null && p.confidence === "advanced");
  return simple ? { simpleMode: true } : dense ? { simpleMode: false } : {};
}

/** Show extra explanations (page purposes, hints): beginners, or anyone in simple mode. */
export function wantsExplanations(plan: FinancialPlan): boolean {
  return plan.profile.confidence === "beginner" || (plan.profile.confidence == null && plan.simpleMode);
}

const pick = <T extends string>(list: readonly T[], v: unknown): T | null => (list.includes(v as T) ? (v as T) : null);

/** A future change: a one-off amount (negative = cost) and a monthly cost change from that year on (positive = spend more). */
export interface LifeEvent {
  name: string;
  year: number;
  amount: number;
  monthlyChange: number;
}

export const DEFAULT_PLAN: FinancialPlan = {
  monthStartDay: 1,
  birthYear: null,
  retirementAge: 67,
  emergencyMonths: 6,
  allocation: { equity: 70, bonds: 20, cash: 10 },
  taxDone: {},
  simpleMode: false,
  wheelPaging: false,
  checkin: { lastWeek: null, streak: 0 },
  events: [],
  profile: EMPTY_PROFILE,
  homeStyle: "companion",
};

const finite = (v: unknown, limit: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(-limit, Math.min(limit, Math.round(n))) : 0;
};

const int = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
};

/** Validate a plan from the client or storage; unknown or bad fields fall back to defaults. */
export function parsePlan(raw: unknown): FinancialPlan {
  const r = (raw ?? {}) as Record<string, unknown>;
  const a = (r.allocation ?? {}) as Record<string, unknown>;
  const t = (r.taxDone ?? {}) as Record<string, unknown>;
  const c = (r.checkin ?? {}) as Record<string, unknown>;
  const p = (r.profile ?? {}) as Record<string, unknown>;
  return {
    monthStartDay: int(r.monthStartDay, 1, 28, DEFAULT_PLAN.monthStartDay),
    birthYear: r.birthYear == null || r.birthYear === "" ? null : int(r.birthYear, 1920, 2015, 0) || null,
    retirementAge: int(r.retirementAge, 40, 80, DEFAULT_PLAN.retirementAge),
    emergencyMonths: int(r.emergencyMonths, 1, 24, DEFAULT_PLAN.emergencyMonths),
    allocation: Object.fromEntries(ALLOCATION_CLASSES.map((c) => [c, int(a[c], 0, 100, DEFAULT_PLAN.allocation[c])])) as Record<AllocationClass, number>,
    taxDone: Object.fromEntries(Object.entries(t).filter(([k, v]) => /^[a-z_]{1,30}$/.test(k) && Number.isInteger(v)).slice(0, 20)) as Record<string, number>,
    simpleMode: r.simpleMode === true,
    wheelPaging: r.wheelPaging === true,
    checkin: {
      lastWeek: typeof c.lastWeek === "string" && /^\d{4}-W\d{2}$/.test(c.lastWeek) ? c.lastWeek : null,
      streak: int(c.streak, 0, 1000, 0),
    },
    events: (Array.isArray(r.events) ? r.events : [])
      .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
      .slice(0, 12)
      .map((e) => ({
        name: String(e.name ?? "").slice(0, 40),
        year: int(e.year, 2000, 2150, new Date().getFullYear()),
        amount: finite(e.amount, 100_000_000),
        monthlyChange: finite(e.monthlyChange, 1_000_000),
      })),
    profile: {
      situation: pick(SITUATIONS, p.situation),
      householdSize: int(p.householdSize, 1, 20, 0) || null,
      goal: pick(GOALS, p.goal),
      goalNote: typeof p.goalNote === "string" ? p.goalNote.trim().slice(0, 60) : "",
      confidence: pick(CONFIDENCE, p.confidence),
      detail: pick(DETAIL, p.detail),
      onboarded: p.onboarded === true,
    },
    homeStyle: pick(HOME_STYLES, r.homeStyle) ?? DEFAULT_PLAN.homeStyle,
  };
}

/** ISO week key, e.g. "2026-W45". */
export function isoWeek(d: Date): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Record a finished check-in: the streak grows if last week was done too, else starts over. */
export function completeCheckin(c: FinancialPlan["checkin"], today: Date): FinancialPlan["checkin"] {
  const now = isoWeek(today);
  if (c.lastWeek === now) return c;
  const lastWeek = isoWeek(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7));
  return { lastWeek: now, streak: c.lastWeek === lastWeek ? c.streak + 1 : 1 };
}
