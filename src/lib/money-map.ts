import type { Asset } from "@/lib/types";
import { liquidCash } from "@/lib/allocation";
import { wealthGroups } from "@/lib/wealth-growth";

export type MapArea =
  "cashflow" | "cushion" | "investments" | "pension" | "debts" | "property" | "netWorth";
export interface MapRow {
  area: MapArea;
  href: string;
  value: number | null;
  target?: number;
  months?: number;
  count?: number;
}
export interface MoneyMapInput {
  forecast: number | null;
  assets: Asset[] | null;
  expenses: number | null;
  emergencyMonths: number;
  hasHomeEvent: boolean;
}

const sum = (xs: Asset[]) => xs.reduce((s, a) => s + (a.valueIls ?? 0), 0);
const pos = (n: number) => (n > 0 ? n : null); // an empty area is an invitation, never a 0 fact

export function buildMoneyMap(i: MoneyMapInput): { rows: MapRow[]; more: MapRow[] } {
  const A = i.assets;
  const exp = i.expenses != null && i.expenses > 0 ? i.expenses : null;
  // note: a money-market fund counts in both cushion (liquidCash) and investments (portfolio) by design.
  const cash = A ? pos(liquidCash(A)) : null;
  const g = A ? wealthGroups(A) : null;
  const liabs = A ? A.filter((a) => a.isLiability) : [];
  const propertyVal = A
    ? pos(sum(A.filter((a) => !a.isLiability && a.type === "real_estate")))
    : null;

  const cushion: MapRow = { area: "cushion", href: "/investments", value: cash };
  if (cash != null && exp) cushion.months = Math.round((cash / exp) * 10) / 10;
  if (exp) cushion.target = exp * i.emergencyMonths;

  const investments = g ? pos(g.portfolio.value) : null;
  const pension = g ? pos(g.pension.value + g.funds.value) : null;
  // a liability of unknown size must not read as "no debts": 0 only when every liability is known
  const debts = A
    ? liabs.some((a) => a.valueIls == null) && sum(liabs) === 0
      ? null
      : sum(liabs)
    : null;
  const property: MapRow = { area: "property", href: "/investments", value: propertyVal };

  const rows: MapRow[] = [
    { area: "cashflow", href: "/?view=detail", value: i.forecast },
    cushion,
    { area: "investments", href: "/investments", value: investments },
    { area: "pension", href: "/fi", value: pension },
    { area: "debts", href: "/investments", value: debts, ...(A ? { count: liabs.length } : {}) },
  ];
  const more: MapRow[] = [];
  (propertyVal != null || i.hasHomeEvent ? rows : more).push(property);

  const filled = [cash, investments, pension, debts, propertyVal].filter(
    (v) => v != null && v !== 0,
  ).length;
  if (A && filled >= 2) {
    const assetsTotal = sum(A.filter((a) => !a.isLiability));
    rows.push({ area: "netWorth", href: "/fi", value: assetsTotal - (debts ?? 0) });
  }
  return { rows, more };
}
