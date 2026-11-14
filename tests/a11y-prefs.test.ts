import { describe, expect, it } from "vitest";
import { a11yClasses, parseA11y, DEFAULT_A11Y, ALL_A11Y_CLASSES } from "@/lib/a11y-prefs";

describe("accessibility preferences → <html> classes", () => {
  it("defaults add nothing", () => {
    expect(a11yClasses(DEFAULT_A11Y)).toEqual([]);
  });

  it("maps every option to its class", () => {
    const all = { textScale: 150, contrast: "dark", spacing: true, readableFont: true, links: true, headings: true, bigCursor: true, stopMotion: true, focus: true, hideImages: true, readingGuide: true } as const;
    expect(a11yClasses(all)).toEqual(["a11y-text-150", "a11y-hc", "a11y-hc-dark", "a11y-spacing", "a11y-font", "a11y-links", "a11y-headings", "a11y-cursor", "a11y-no-motion", "a11y-focus", "a11y-no-images", "a11y-guide"]);
    for (const c of a11yClasses(all)) expect(ALL_A11Y_CLASSES).toContain(c);
  });

  it("light high contrast and text size", () => {
    expect(a11yClasses({ ...DEFAULT_A11Y, textScale: 115, contrast: "light" })).toEqual(["a11y-text-115", "a11y-hc", "a11y-hc-light"]);
  });

  it("parse drops unknown and invalid values", () => {
    expect(parseA11y("not json")).toEqual(DEFAULT_A11Y);
    expect(parseA11y(null)).toEqual(DEFAULT_A11Y);
    expect(parseA11y({ textScale: 999, contrast: "neon", links: "yes", focus: true, evil: 1 })).toEqual({ ...DEFAULT_A11Y, focus: true });
    expect(parseA11y(JSON.stringify({ textScale: 130, contrast: "light" }))).toEqual({ ...DEFAULT_A11Y, textScale: 130, contrast: "light" });
  });
});
