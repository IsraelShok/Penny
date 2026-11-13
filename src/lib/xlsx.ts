/**
 * Minimal .xlsx reader with no dependencies: zip central directory + DecompressionStream,
 * then every worksheet in order (card exports split domestic/abroad by sheet) as rows of strings (numbers as their plain string, so Excel
 * date serials come through as e.g. "45292"). Formulas give their cached value.
 */

// shortcut: regex XML extraction instead of DOMParser so it also runs in node tests; fine for sheet/sharedStrings XML.
const decodeXml = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) =>
    e[0] === "#"
      ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1)))
      : ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" } as Record<string, string>)[e.toLowerCase()],
  );

async function unzip(bytes: Uint8Array): Promise<Map<string, () => Promise<string>>> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("not a zip file");
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const files = new Map<string, () => Promise<string>>();
  for (let n = 0; n < count; n++) {
    if (view.getUint32(p, true) !== 0x02014b50) throw new Error("bad zip directory");
    const method = view.getUint16(p + 10, true);
    const size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const local = view.getUint32(p + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + view.getUint16(p + 30, true) + view.getUint16(p + 32, true);
    files.set(name, async () => {
      const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
      const data = bytes.slice(start, start + size);
      if (method === 0) return new TextDecoder().decode(data);
      if (method !== 8) throw new Error(`unsupported zip method ${method}`);
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      return new Response(stream).text();
    });
  }
  return files;
}

const colIndex = (ref: string) => {
  let n = 0;
  for (const ch of ref.replace(/\d+$/, "")) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
};

export async function readXlsx(input: ArrayBuffer | Uint8Array): Promise<string[][]> {
  const files = await unzip(input instanceof Uint8Array ? input : new Uint8Array(input));
  const sheetNames = [...files.keys()]
    .filter((k) => /^xl\/worksheets\/[^/]+\.xml$/.test(k))
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  if (!sheetNames.length) throw new Error("no worksheet");
  const shared: string[] = [];
  const ss = await files.get("xl/sharedStrings.xml")?.();
  for (const si of ss?.match(/<si>[\s\S]*?<\/si>/g) ?? []) {
    // Phonetic runs (<rPh>) are hints, not cell text.
    const body = si.replace(/<rPh[\s\S]*?<\/rPh>/g, "");
    shared.push(decodeXml([...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join("")));
  }
  const rows: string[][] = [];
  for (const sheetName of sheetNames) {
    const xml = await files.get(sheetName)!();
    for (const rowMatch of xml.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const row: string[] = [];
      for (const c of (rowMatch[1] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = c[1];
        const inner = c[2] ?? "";
        const ref = /\br="([A-Z]+\d*)"/.exec(attrs)?.[1];
        const type = /\bt="(\w+)"/.exec(attrs)?.[1];
        const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
        let text = "";
        if (type === "s") text = shared[Number(v)] ?? "";
        else if (type === "inlineStr") text = decodeXml([...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(""));
        else if (v != null) text = decodeXml(v);
        const i = ref ? colIndex(ref) : row.length;
        while (row.length < i) row.push("");
        row[i] = text.trim();
      }
      if (row.some((f) => f !== "")) rows.push(row);
    }
  }
  return rows;
}
