import { NextResponse } from "next/server";
import {
  getLegacyExportConfig,
  openLegacyFolder,
  runLegacyExport,
  storeLegacySnapshot,
  updateLegacyExportConfig,
} from "@/server/lib/legacy-export";

const HTML_MAX = 2_000_000;
const fail = (e: unknown) => NextResponse.json({ error: e instanceof Error ? e.message : "invalid" }, { status: 400 });

/** Auto-export settings and last result. */
export async function GET() {
  return NextResponse.json(getLegacyExportConfig());
}

export async function PATCH(request: Request) {
  try {
    // The page re-sends its document after a change here, which triggers the export.
    return NextResponse.json(updateLegacyExportConfig(await request.json()));
  } catch (e) {
    return fail(e);
  }
}

/** { html }: the page's rendered document changed — store it and export now if enabled. { action: "open" }: open the folder. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { html?: unknown; action?: unknown };
    if (body.action === "open") {
      openLegacyFolder();
      return NextResponse.json(getLegacyExportConfig());
    }
    if (typeof body.html !== "string" || !body.html || body.html.length > HTML_MAX) throw new Error("invalid html");
    storeLegacySnapshot(body.html);
    const c = getLegacyExportConfig();
    return NextResponse.json(c.enabled ? runLegacyExport() : c);
  } catch (e) {
    return fail(e);
  }
}
