import { NextResponse } from "next/server";
import { MARKETS } from "@/lib/markets";
import { getQuotes } from "@/server/markets/quotes";
import type { MarketsPayload } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const quotes = await getQuotes(MARKETS.map((m) => m.symbol));
  const payload: MarketsPayload = {
    items: MARKETS.map((m) => ({ ...m, quote: quotes.get(m.symbol.toUpperCase()) ?? null })),
  };
  return NextResponse.json(payload);
}
