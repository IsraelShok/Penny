import { BANK_PROVIDERS, type Asset, type Goal, type InsurancePolicy, type Integration } from "./types";

/** Free text the user writes for the family document. Plain text only, never secrets. */
export interface LegacyNotes {
  contacts: string;
  documents: string;
  wishes: string;
  /** null = use the gentle default checklist. */
  steps: string | null;
}

export const LEGACY_FIELDS = ["contacts", "documents", "wishes", "steps"] as const;
export const LEGACY_TEXT_MAX = 4000;
export const EMPTY_NOTES: LegacyNotes = { contacts: "", documents: "", wishes: "", steps: null };

/** Validates untrusted input; throws on anything that is not short plain text. */
export function parseLegacyNotes(raw: unknown): LegacyNotes {
  if (!raw || typeof raw !== "object") throw new Error("notes must be an object");
  const r = raw as Record<string, unknown>;
  const out: LegacyNotes = { ...EMPTY_NOTES };
  for (const k of LEGACY_FIELDS) {
    const v = r[k];
    if (v == null) continue;
    if (typeof v !== "string") throw new Error(`${k} must be text`);
    if (v.length > LEGACY_TEXT_MAX) throw new Error(`${k} is too long`);
    out[k] = v;
  }
  return out;
}

export interface LegacyRow {
  title: string;
  /** Institution, fund, account digits — never credentials. */
  detail?: string;
  amount?: number | null;
  monthly?: number | null;
  /** i18n key suffix (asset type / policy kind), rendered by the page. */
  kind?: string;
  saved?: number;
  /** YYYY-MM or month number as text. */
  when?: string;
}

export type LegacySectionId = "banks" | "cards" | "investments" | "pension" | "insurance" | "debts" | "recurring" | "goals";
export interface LegacySection { id: LegacySectionId; rows: LegacyRow[] }

export interface LegacyInput {
  assets: Asset[];
  policies: InsurancePolicy[];
  goals: Goal[];
  integrations: Integration[];
  /** Accounts seen in transactions (card / bank account numbers). */
  accounts: { accountNumber: string; label: string | null; provider: string }[];
  recurring: { merchant: string; account: string; expectedAmount: number; cadence: string }[];
  /** Localized provider name; defaults to the English name. */
  providerName?: (id: string) => string;
}

const englishProviderName = (id: string) => BANK_PROVIDERS.find((b) => b.id === id)?.name ?? id;
const providerKind = (id: string) => BANK_PROVIDERS.find((b) => b.id === id)?.kind;
const last4 = (s: string) => s.replace(/\D/g, "").slice(-4);
const PENSION = new Set(["pension", "study_fund", "provident"]);

/** Assembles the document from whitelisted fields only, so secrets cannot leak in. */
export function buildLegacySections(d: LegacyInput): LegacySection[] {
  const providerName = d.providerName ?? englishProviderName;
  const own = d.assets.filter((a) => !a.isLiability);
  const cardAccounts = d.accounts.filter((a) => providerKind(a.provider) === "card");
  const cardProviders = new Set(cardAccounts.map((a) => a.provider));
  const sections: LegacySection[] = [
    {
      id: "banks",
      rows: [
        ...own.filter((a) => a.type === "cash").map((a) => ({ title: a.name, amount: a.valueIls })),
        ...d.integrations
          .filter((i) => providerKind(i.provider) === "bank" && !own.some((a) => a.type === "cash" && a.name.includes(providerName(i.provider))))
          .map((i) => ({ title: providerName(i.provider), detail: i.label || undefined })),
      ],
    },
    {
      id: "cards",
      rows: [
        ...cardAccounts.map((a) => ({ title: providerName(a.provider), detail: `•••• ${last4(a.accountNumber)}${a.label ? ` · ${a.label}` : ""}` })),
        ...d.integrations
          .filter((i) => providerKind(i.provider) === "card" && !cardProviders.has(i.provider))
          .map((i) => ({ title: providerName(i.provider), detail: i.label || undefined })),
      ],
    },
    {
      id: "investments",
      rows: own
        .filter((a) => a.type !== "cash" && !PENSION.has(a.type))
        .map((a) => ({ title: a.name, kind: a.type, detail: a.symbol ?? undefined, amount: a.valueIls })),
    },
    {
      id: "pension",
      rows: own.filter((a) => PENSION.has(a.type)).map((a) => ({
        title: a.name,
        kind: a.type,
        detail: [a.fund?.fund.company, a.fund?.fund.name, a.fundId ? `#${a.fundId}` : null].filter(Boolean).join(" · ") || undefined,
        amount: a.valueIls,
      })),
    },
    {
      id: "insurance",
      rows: d.policies.map((p) => ({
        title: p.name,
        kind: p.kind,
        detail: p.provider ?? undefined,
        monthly: p.monthlyPremium,
        when: p.renewalMonth != null ? p.renewalMonth : undefined,
      })),
    },
    {
      id: "debts",
      rows: d.assets.filter((a) => a.isLiability).map((a) => ({ title: a.name, kind: a.type, amount: a.valueIls, monthly: a.monthlyPayment })),
    },
    {
      id: "recurring",
      rows: d.recurring.map((s) => ({ title: s.merchant, detail: s.account ? `•••• ${last4(s.account)}` : undefined, amount: s.expectedAmount, kind: s.cadence })),
    },
    {
      id: "goals",
      rows: d.goals.map((g) => ({ title: g.name, amount: g.targetAmount, saved: g.savedAmount, when: g.targetDate ?? undefined })),
    },
  ];
  return sections;
}
