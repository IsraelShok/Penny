// Household profile and life events — stored as one JSON workspace setting.

export const MEMBER_ROLES = ["me", "partner", "child", "roommate", "exPartner", "parent", "sibling"] as const;
export const INCOME_SHAPES = ["salaried", "freelancer", "mixed", "pension", "allowance", "irregular", "none"] as const;
export const MONEY_STYLES = ["joint", "mixed", "separate"] as const;
export const LIFE_EVENTS = [
  "birth", "firstJob", "armyRelease", "movedIn", "wedding", "homePurchase", "newChild",
  "jobLoss", "startedBusiness", "divorce", "illness", "caringParent", "retirement", "loss",
] as const;
// Events that trigger a one-time gentle-mode suggestion.
export const HARD_EVENTS: readonly LifeEventType[] = ["jobLoss", "divorce", "illness", "loss"];

export type MemberRole = (typeof MEMBER_ROLES)[number];
export type IncomeShape = (typeof INCOME_SHAPES)[number];
export type MoneyStyle = (typeof MONEY_STYLES)[number];
export type LifeEventType = (typeof LIFE_EVENTS)[number];

export interface HouseholdMember { id: string; name: string; role: MemberRole; birthYear: number | null }
export interface LifeEvent { id: string; type: LifeEventType; date: string }

export interface Household {
  members: HouseholdMember[];
  incomeShape: IncomeShape | null;
  moneyStyle: MoneyStyle | null;
  gentleMode: boolean;
  gentleSuggestionDismissed: boolean;
  /** The Home prompt for the 3-minute welcome was dismissed or completed. */
  welcomeDismissed: boolean;
  events: LifeEvent[];
}

export const EMPTY_HOUSEHOLD: Household = {
  members: [], incomeShape: null, moneyStyle: null,
  gentleMode: false, gentleSuggestionDismissed: false, welcomeDismissed: false, events: [],
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ITEMS = 100;

function str(v: unknown, max = 80): string {
  if (typeof v !== "string" || v.trim() === "" || v.length > max) throw new Error("invalid text");
  return v.trim();
}
function oneOf<T extends string>(list: readonly T[], v: unknown): T {
  if (!list.includes(v as T)) throw new Error("invalid value");
  return v as T;
}
function amount(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1e10) throw new Error("invalid amount");
  return v;
}
function list<T>(v: unknown, map: (x: Record<string, unknown>) => T): T[] {
  if (!Array.isArray(v) || v.length > MAX_ITEMS) throw new Error("invalid list");
  return v.map((x) => map((x ?? {}) as Record<string, unknown>));
}
function date(v: unknown): string {
  if (typeof v !== "string" || !DATE_RE.test(v)) throw new Error("invalid date");
  return v;
}

// Validates untrusted input (request body or stored JSON); throws on bad shape.
export function parseHousehold(raw: unknown): Household {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    members: list(o.members ?? [], (m) => ({
      id: str(m.id, 40),
      name: str(m.name),
      role: oneOf(MEMBER_ROLES, m.role),
      birthYear: m.birthYear == null ? null : Math.round(amount(m.birthYear)),
    })),
    incomeShape: o.incomeShape == null ? null : oneOf(INCOME_SHAPES, o.incomeShape),
    moneyStyle: o.moneyStyle == null ? null : oneOf(MONEY_STYLES, o.moneyStyle),
    gentleMode: o.gentleMode === true,
    gentleSuggestionDismissed: o.gentleSuggestionDismissed === true,
    welcomeDismissed: o.welcomeDismissed === true,
    events: list(o.events ?? [], (e) => ({ id: str(e.id, 40), type: oneOf(LIFE_EVENTS, e.type), date: date(e.date) })),
  };
}

export function shouldSuggestGentle(h: Household): boolean {
  return !h.gentleMode && !h.gentleSuggestionDismissed && h.events.some((e) => HARD_EVENTS.includes(e.type));
}

export function shouldShowWelcome(h: Household): boolean {
  return !h.welcomeDismissed && h.members.length === 0 && h.incomeShape == null && h.moneyStyle == null;
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}
