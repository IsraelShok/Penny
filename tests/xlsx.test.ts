import { describe, expect, it } from "vitest";
import { readXlsx } from "@/lib/xlsx";

// Builds a zip in memory; `deflate` entries use CompressionStream("deflate-raw"), the rest are stored.
async function zip(files: Record<string, string>, deflate: string[]): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const raw = enc.encode(text);
    const method = deflate.includes(name) ? 8 : 0;
    const data = method
      ? new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer())
      : raw;
    const n = enc.encode(name);
    const local = new Uint8Array(30 + n.length + data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(8, method, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, raw.length, true);
    lv.setUint16(26, n.length, true);
    local.set(n, 30);
    local.set(data, 30 + n.length);
    const cd = new Uint8Array(46 + n.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(10, method, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, raw.length, true);
    cv.setUint16(28, n.length, true);
    cv.setUint32(42, offset, true);
    cd.set(n, 46);
    locals.push(local);
    central.push(cd);
    offset += local.length;
  }
  const cdSize = central.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, central.length, true);
  ev.setUint16(10, central.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  const out = new Uint8Array(offset + cdSize + 22);
  let p = 0;
  for (const part of [...locals, ...central, end]) { out.set(part, p); p += part.length; }
  return out;
}

const sheet = `<?xml version="1.0"?><worksheet><sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c></row>
<row r="3"><c r="A3" t="s"><v>1</v></c><c r="B3" t="inlineStr"><is><t>שם בית העסק</t></is></c><c r="C3" t="str"><v>סכום</v></c></row>
<row r="4"><c r="A4"><v>45292</v></c><c r="B4" t="s"><v>2</v></c><c r="D4"><v>-12.5</v></c></row>
<row r="5"/>
</sheetData></worksheet>`;
const strings = `<sst><si><t>פירוט עסקאות</t></si><si><r><t>תאריך </t></r><r><t>עסקה</t></r></si><si><t>שופרסל &amp; בניו</t><rPh><t>x</t></rPh></si></sst>`;

describe("readXlsx", () => {
  it("reads shared, inline and numeric cells from a deflated sheet", async () => {
    const bytes = await zip({ "[Content_Types].xml": "<Types/>", "xl/sharedStrings.xml": strings, "xl/worksheets/sheet1.xml": sheet }, ["xl/worksheets/sheet1.xml"]);
    expect(await readXlsx(bytes)).toEqual([
      ["פירוט עסקאות"],
      ["תאריך עסקה", "שם בית העסק", "סכום"],
      ["45292", "שופרסל & בניו", "", "-12.5"],
    ]);
  });

  it("rejects non-zip input", async () => {
    await expect(readXlsx(new TextEncoder().encode("a,b\n1,2"))).rejects.toThrow();
  });
});
