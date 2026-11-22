import "server-only";
import { listCommitments } from "@/server/db/queries/financial-control";
import { getBillReminderDays } from "@/server/db/queries/settings";
import { commitmentDates } from "@/lib/financial-control";
import { chargesBetween } from "@/lib/balance-forecast";
import { dueReminders, type BillReminder, type ExpectedBill } from "@/lib/bill-reminders";
import { addDays } from "../lib/date-utils";
import { loadInsights } from "./data";

/** Recurring charges and commitments expected within the workspace's reminder window. */
export function billReminders(ws: number, today: string): BillReminder[] {
  const days = getBillReminderDays(ws);
  if (days <= 0) return [];
  const to = addDays(today, days);
  const commitments = listCommitments(ws);
  // A commitment that tracks a detected series replaces it.
  const tracked = new Set(commitments.map((c) => c.seriesKey).filter(Boolean));
  const bills: ExpectedBill[] = [
    ...loadInsights(ws, today)
      .series.filter(
        (s) => s.status === "suggested" && !tracked.has(`${s.account}|${s.merchant}|${s.currency}`),
      )
      .flatMap((s) =>
        chargesBetween(s.cadence, s.lastDate, today, to).map((date) => ({
          source: `s:${s.account}|${s.merchant}|${s.currency}`,
          name: s.merchant,
          amount: Math.abs(s.expectedAmount),
          date,
        })),
      ),
    ...commitments.flatMap((c) =>
      commitmentDates(c, today, to).map((date) => ({
        source: `c:${c.id}`,
        name: c.name,
        amount: Math.abs(c.amount),
        date,
      })),
    ),
  ];
  return dueReminders(bills, today, days);
}
