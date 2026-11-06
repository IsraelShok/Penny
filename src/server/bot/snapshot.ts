import "server-only";

import { loadInsights } from "../insights/data";
import { forecastCards } from "../insights/forecast";
import { computeCashAhead } from "../insights/cash-ahead";
import { getLastSyncRun } from "../db/queries/sync-runs";
import type { CashAhead } from "@/lib/cash-ahead";

export interface Snapshot {
  cash: CashAhead;
  monthTotal: number;
  topCategories: { name: string; total: number }[];
  bills: { date: string; total: number; account?: string | null }[];
  subs: { merchant: string; amount: number }[];
  lastSync: string | null;
}

export function buildSnapshot(ws: number, today: string): Snapshot {
  const i = loadInsights(ws, today, Number(process.env.CARD_BILLING_DAY) || 10);
  const bills = forecastCards({ today, cards: i.cards, series: i.series, installments: i.installments });
  return {
    cash: computeCashAhead(ws, today),
    monthTotal: i.monthTotal,
    topCategories: i.topCategories,
    bills: bills.map((b) => ({ date: b.date, total: b.total, account: b.account })),
    subs: i.series.filter((s) => s.status === "suggested" && s.cadence === "monthly").map((s) => ({ merchant: s.merchant, amount: s.expectedAmount })),
    lastSync: getLastSyncRun(ws)?.startedAt ?? null,
  };
}

const showMoney = (n: number) => `₪${Math.round(Math.abs(n)).toLocaleString("he-IL")}`;
const day = (iso: string) => new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${iso.slice(0, 10)}T12:00:00Z`));

function freeLine(c: CashAhead, money: (n: number) => string): string {
  if (c.safeToSpend == null) return "עוד אין יתרת בנק מסונכרנת, אז אין סכום פנוי.";
  if (c.safeToSpend < 0) return `🔴 חסרים ${money(c.safeToSpend)} עד ${day(c.until)}.`;
  return `🟢 ${money(c.safeToSpend)} פנויים עד ${day(c.until)}, בערך ${money(c.safeToSpend / Math.max(1, c.daysLeft))} ליום.`;
}

/** Three lines: free money, month spend, next card bill. */
const moneyFor = (hide: boolean) => (hide ? () => "•••" : showMoney);

export function formatShort(s: Snapshot, hide = false): string {
  const money = moneyFor(hide);
  const next = s.bills[0];
  return [
    freeLine(s.cash, money),
    `הוצאות החודש: ${money(s.monthTotal)}`,
    next ? `חיוב אשראי הבא: ${money(next.total)} ב־${day(next.date)}` : null,
  ].filter(Boolean).join("\n");
}

export function formatFull(s: Snapshot, hide = false): string {
  const money = moneyFor(hide);
  const sections = [
    `📊 תמונת מצב\n${formatShort(s, hide)}`,
    s.topCategories.length ? `הקטגוריות הגדולות החודש:\n${s.topCategories.slice(0, 5).map((c) => `• ${c.name}: ${money(c.total)}`).join("\n")}` : null,
    s.bills.length ? `חיובי אשראי צפויים:\n${s.bills.slice(0, 3).map((b) => `• ${day(b.date)}${b.account ? ` (כרטיס ${b.account.slice(-4)})` : ""}: ${money(b.total)}`).join("\n")}` : null,
    s.subs.length ? `מנויים חודשיים: ${s.subs.length}, ביחד ${money(s.subs.reduce((t, x) => t + x.amount, 0))} בחודש` : null,
    `סנכרון אחרון: ${s.lastSync ? s.lastSync.slice(0, 16).replace("T", " ") : "עוד לא היה"}`,
  ];
  return sections.filter(Boolean).join("\n\n");
}
