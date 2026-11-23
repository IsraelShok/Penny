import { handle } from "@/server/lib/api-error";
import { NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";
import { aiSupportsImages, completeAI } from "@/server/ai/ask";
import { israelToday } from "@/server/lib/date-utils";
import { redact } from "@/server/lib/redact";
import { sniffFileKind } from "@/lib/csv";
import {
  EXTRACT_SYSTEM,
  MAX_TEXT_IMPORT,
  parseExtractedRows,
  sniffImageType,
} from "@/lib/text-import";

export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;
const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/**
 * Import from a PDF statement or a photo/screenshot of one. A PDF's text is read here, on this
 * machine; only that text (or the image, for a vision-capable provider) goes to the user's own AI
 * provider. Rows come back for the sheet import's preview; nothing is saved here.
 */
export const POST = handle("import/document", async (request: Request) => {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof Blob) || file.size === 0) return fail("empty", 400);
  if (file.size > MAX_BYTES) return fail("tooLarge", 413);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const today = israelToday();

  const image = sniffImageType(bytes);
  let reply: string | null;
  try {
    if (image) {
      if (!aiSupportsImages()) return fail("needsVision", 415);
      reply = await completeAI(
        EXTRACT_SYSTEM,
        `Today is ${today}.\n\nThe image is the statement.`,
        4000,
        { base64: Buffer.from(bytes).toString("base64"), mediaType: image },
      );
    } else if (sniffFileKind(bytes) === "pdf") {
      let text: string;
      try {
        const pdf = await getDocumentProxy(bytes);
        text = (await extractText(pdf, { mergePages: true })).text.trim();
      } catch {
        return fail("readFailed", 422);
      }
      // A scanned PDF has no text layer; there is no local OCR.
      if (!text) return fail("noText", 422);
      if (text.length > MAX_TEXT_IMPORT) return fail("tooLong", 413);
      reply = await completeAI(
        EXTRACT_SYSTEM,
        `Today is ${today}.\n\nText:\n${redact(text)}`,
        4000,
      );
    } else return fail("unsupported", 415);
  } catch {
    return fail("aiFailed", 502);
  }
  if (reply == null) return fail("noProvider", 503);
  return NextResponse.json({ rows: parseExtractedRows(reply) });
});
