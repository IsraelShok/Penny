import { handle, readJson, domainMessage } from "@/server/lib/api-error";
import { NextResponse } from "next/server";
import {
  getLegacyExportConfig,
  openLegacyFolder,
  runLegacyExport,
  storeLegacySnapshot,
  updateLegacyExportConfig,
} from "@/server/lib/legacy-export";

const HTML_MAX = 2_000_000;
/** A validation key ("notAbsolute") or a malformed body answers 400; disk and database trouble (it carries a code) goes to handle(). */
const fail = (e: unknown) => {
  if (e instanceof Error && "code" in e) throw e;
  return NextResponse.json({ error: domainMessage(e) ?? "invalid" }, { status: 400 });
};

/** Auto-export settings and last result. */
export const GET = handle("legacy/export", async () => {
  return NextResponse.json(getLegacyExportConfig());
});

export const PATCH = handle("legacy/export", async (request: Request) => {
  try {
    // The page re-sends its document after a change here, which triggers the export.
    return NextResponse.json(updateLegacyExportConfig(await readJson(request)));
  } catch (e) {
    return fail(e);
  }
});

/** { html }: the page's rendered document changed — store it and export now if enabled. { action: "open" }: open the folder. */
export const POST = handle("legacy/export", async (request: Request) => {
  try {
    const body = (await readJson(request)) as { html?: unknown; action?: unknown };
    if (body.action === "open") {
      openLegacyFolder();
      return NextResponse.json(getLegacyExportConfig());
    }
    if (typeof body.html !== "string" || !body.html || body.html.length > HTML_MAX)
      throw new Error("invalid html");
    storeLegacySnapshot(body.html);
    const c = getLegacyExportConfig();
    return NextResponse.json(c.enabled ? runLegacyExport() : c);
  } catch (e) {
    return fail(e);
  }
});
