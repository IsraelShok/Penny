import type { StoryCard } from "./recap-story";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Greedy word wrap by character count; good enough for one short sentence. */
export function wrap(text: string, max: number) {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(" ")) {
      if (line && (line + " " + word).length > max) { lines.push(line); line = word; }
      else line = line ? `${line} ${word}` : word;
    }
    lines.push(line);
  }
  return lines;
}

/** The card as a standalone SVG, in the wallet card's colors. */
export function cardSvg(card: StoryCard, rtl: boolean, size = 1080) {
  const pad = 96;
  const x = rtl ? size - pad : pad;
  const attrs = `x="${x}" direction="${rtl ? "rtl" : "ltr"}" text-anchor="start" font-family="Heebo, Arial, sans-serif"`;
  const lines = wrap(card.text, 26);
  const textTop = size - pad - (lines.length - 1) * 64;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<rect width="100%" height="100%" rx="72" fill="#1c1c1e"/>
<text ${attrs} y="${pad + 40}" font-size="40" font-weight="600" fill="#b0b0b8">${esc(card.title)}</text>
${card.figure ? `<text ${attrs} y="${pad + 260}" font-size="150" font-weight="300" fill="#ffffff" style="font-variant-numeric: tabular-nums">${esc(card.figure)}</text>` : ""}
${lines.map((l, i) => `<text ${attrs} y="${textTop + i * 64}" font-size="48" font-weight="600" fill="#ffffff">${esc(l)}</text>`).join("\n")}
<text x="${rtl ? pad : size - pad}" y="${pad + 40}" text-anchor="${rtl ? "start" : "end"}" font-family="Heebo, Arial, sans-serif" font-size="32" fill="#b0b0b8">Penny</text>
</svg>`;
}

/** SVG → Image → canvas → PNG download, browser APIs only. */
export async function saveCardAsPng(card: StoryCard, rtl: boolean, filename: string) {
  const url = URL.createObjectURL(new Blob([cardSvg(card, rtl)], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = reject; img.src = url; });
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext("2d")!.drawImage(img, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("toBlob failed");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  } finally {
    URL.revokeObjectURL(url);
  }
}
