/**
 * Category color families. Each top-level group owns one OKLCH hue; its subcategories are
 * the same hue at stepped lightness (plus a small hue nudge after six), so siblings stay
 * distinguishable but read as one family. Pure, shared by the server and the client.
 */

export interface Oklch {
  l: number;
  c: number;
  h: number;
}

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const toGamma = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

export function hexToOklch(hex: string): Oklch {
  const n = Number.parseInt(hex.replace("#", "").slice(0, 6), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => toLinear(v / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { l: L, c: Math.hypot(A, B), h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 };
}

function oklchToRgb({ l: L, c, h }: Oklch): [number, number, number] {
  const A = c * Math.cos((h * Math.PI) / 180),
    B = c * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** #RRGGBB for an OKLCH color; chroma is lowered until it fits sRGB so the hue holds. */
function oklchToHex(color: Oklch): string {
  let c = color.c,
    rgb = oklchToRgb(color);
  while (c > 0 && rgb.some((v) => v < -1e-4 || v > 1 + 1e-4))
    rgb = oklchToRgb({ ...color, c: (c = Math.max(0, c - 0.005)) });
  return (
    "#" +
    rgb
      .map((v) =>
        Math.round(Math.min(1, Math.max(0, toGamma(Math.max(0, v)))) * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
      .toUpperCase()
  );
}

/** Subcategory lightness bands: 0.60-0.84 reads as a pastel dot on white and on the dark card. */
const CHILD_L = [0.68, 0.8, 0.6, 0.74, 0.84, 0.64];
const CHILD_H = [0, 14, -14];

/** Default color of the `index`-th subcategory (0-based, in creation order) of a group. */
export function childColor(parentHex: string, index: number): string {
  const p = hexToOklch(parentHex);
  const i = Math.max(0, Math.floor(index));
  return oklchToHex({
    l: CHILD_L[i % CHILD_L.length],
    c: p.c,
    h: p.h + CHILD_H[Math.floor(i / CHILD_L.length) % CHILD_H.length],
  });
}

/** Swatches offered when creating a subcategory: the group's family. */
export function familySwatches(parentHex: string, count = CHILD_L.length): string[] {
  return Array.from({ length: count }, (_, i) => childColor(parentHex, i));
}
