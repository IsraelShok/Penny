import { handle } from "@/server/lib/api-error";
import { addDays, israelToday } from "@/server/lib/date-utils";
import { NextResponse } from "next/server";
import { getCurrencyUsage } from "@/server/db/queries/transactions";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";
import { dailyRates } from "@/server/insights/fx-rates";

export const dynamic = "force-dynamic";

/** Currencies in use with today's shekel rate and its 30-day change (null when no rate is available, e.g. offline or demo). */
export const GET = handle("currencies", async (request: Request) => {
  const usage = getCurrencyUsage(getWorkspaceIdFromRequest(request));
  const today = israelToday();
  const rates = await dailyRates(
    usage.map((u) => u.currency),
    today,
  );
  const monthAgo = addDays(today, -30);
  const currencies = usage.map((u) => {
    const closes = rates[u.currency] ?? [];
    const last = closes.at(-1) ?? null;
    const before = [...closes].reverse().find((c) => c.date <= monthAgo) ?? null;
    return {
      ...u,
      rate: u.currency === "ILS" ? 1 : (last?.close ?? null),
      asOf: last?.date ?? null,
      change30d: last && before ? (last.close - before.close) / before.close : null,
    };
  });
  return NextResponse.json({ base: "ILS", currencies });
});
