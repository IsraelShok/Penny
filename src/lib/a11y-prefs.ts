/** Accessibility menu: the saved choices and the <html> classes that apply them (styles in src/app/a11y.css). */

export const A11Y_KEY = "penny.a11y.v1";
/** Mirror of the active profile's classes, read by the pre-paint script in the root layout. */
export const A11Y_CLASSES_KEY = "penny.a11y.classes";

export const TEXT_SCALES = [100, 115, 130, 150] as const;
export type TextScale = (typeof TEXT_SCALES)[number];
export type Contrast = "off" | "light" | "dark";

export type A11yPrefs = {
  textScale: TextScale;
  contrast: Contrast;
  spacing: boolean;
  readableFont: boolean;
  links: boolean;
  headings: boolean;
  bigCursor: boolean;
  stopMotion: boolean;
  focus: boolean;
  hideImages: boolean;
  readingGuide: boolean;
};

export const A11Y_TOGGLES = [
  "spacing",
  "readableFont",
  "links",
  "headings",
  "bigCursor",
  "stopMotion",
  "focus",
  "hideImages",
  "readingGuide",
] as const;
export type A11yToggle = (typeof A11Y_TOGGLES)[number];

export const DEFAULT_A11Y: A11yPrefs = {
  textScale: 100,
  contrast: "off",
  spacing: false,
  readableFont: false,
  links: false,
  headings: false,
  bigCursor: false,
  stopMotion: false,
  focus: false,
  hideImages: false,
  readingGuide: false,
};

const TOGGLE_CLASS: Record<A11yToggle, string> = {
  spacing: "a11y-spacing",
  readableFont: "a11y-font",
  links: "a11y-links",
  headings: "a11y-headings",
  bigCursor: "a11y-cursor",
  stopMotion: "a11y-no-motion",
  focus: "a11y-focus",
  hideImages: "a11y-no-images",
  readingGuide: "a11y-guide",
};

/** Every class this menu can set, so turning an option off removes exactly what it added. */
export const ALL_A11Y_CLASSES = [
  ...TEXT_SCALES.filter((s) => s !== 100).map((s) => `a11y-text-${s}`),
  "a11y-hc",
  "a11y-hc-light",
  "a11y-hc-dark",
  ...Object.values(TOGGLE_CLASS),
];

export function a11yClasses(p: A11yPrefs): string[] {
  const out: string[] = [];
  if (p.textScale !== 100) out.push(`a11y-text-${p.textScale}`);
  if (p.contrast !== "off") out.push("a11y-hc", `a11y-hc-${p.contrast}`);
  for (const k of A11Y_TOGGLES) if (p[k]) out.push(TOGGLE_CLASS[k]);
  return out;
}

/** Tolerates missing, old or hand-edited values: anything unknown falls back to the default. */
export function parseA11y(raw: unknown): A11yPrefs {
  let v: unknown = raw;
  if (typeof raw === "string") {
    try {
      v = JSON.parse(raw);
    } catch {
      v = null;
    }
  }
  if (!v || typeof v !== "object") return { ...DEFAULT_A11Y };
  const o = v as Record<string, unknown>;
  const out: A11yPrefs = { ...DEFAULT_A11Y };
  if (TEXT_SCALES.includes(o.textScale as TextScale)) out.textScale = o.textScale as TextScale;
  if (o.contrast === "light" || o.contrast === "dark") out.contrast = o.contrast;
  for (const k of A11Y_TOGGLES) if (typeof o[k] === "boolean") out[k] = o[k] as boolean;
  return out;
}

export function applyA11yClasses(root: HTMLElement, p: A11yPrefs) {
  root.classList.remove(...ALL_A11Y_CLASSES);
  root.classList.add(...a11yClasses(p));
}

/** True when motion should stop: the OS setting or the menu's "Stop animations". */
export function motionReduced(): boolean {
  if (typeof window === "undefined") return false;
  return (
    document.documentElement.classList.contains("a11y-no-motion") ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
