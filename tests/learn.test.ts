import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { ARTICLES, TOPICS } from "@/content/learn";

const routeExists = (href: string) => fs.existsSync(path.join(__dirname, "..", "src", "app", ...href.split("/").filter(Boolean), "page.tsx"));

describe("knowledge center content", () => {
  it("has unique slugs and known topics", () => {
    expect(new Set(ARTICLES.map((a) => a.slug)).size).toBe(ARTICLES.length);
    for (const a of ARTICLES) expect(TOPICS).toContain(a.topic);
  });

  it("is written in both languages", () => {
    for (const a of ARTICLES) {
      const texts = [a.title, a.summary, a.takeaway, ...a.sections.flatMap((s) => [s.heading, ...s.body])];
      for (const t of texts) {
        expect(t.he.trim(), a.slug).not.toBe("");
        expect(t.en.trim(), a.slug).not.toBe("");
      }
    }
  });

  it("links each guide to a calculator page that exists", () => {
    for (const a of ARTICLES) if (a.calculator) expect(routeExists(a.calculator.href), `${a.slug} → ${a.calculator.href}`).toBe(true);
  });
});
