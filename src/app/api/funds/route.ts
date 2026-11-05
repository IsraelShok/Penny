import { NextResponse } from "next/server";
import { loadFunds } from "@/server/markets/funds";
import { searchFunds } from "@/lib/funds";

export const dynamic = "force-dynamic";

/** ?source=gemel|pension&q=… — funds whose name holds every word, from the latest public report. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const source = params.get("source");
  if (source !== "gemel" && source !== "pension") return NextResponse.json({ error: "source must be gemel or pension" }, { status: 400 });
  const q = (params.get("q") ?? "").slice(0, 80);
  return NextResponse.json({ funds: searchFunds(await loadFunds(source), q) });
}
