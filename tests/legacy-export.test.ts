import { describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

vi.mock("@/server/db/queries/settings", () => ({ getGlobalSetting: () => null, setGlobalSetting: () => {} }));
vi.mock("@/server/lib/encryption", () => ({ isKeyLocked: () => false }));

import { legacyFileName, validateDir, writeLegacyFile } from "@/server/lib/legacy-export";

describe("legacy auto-export files", () => {
  it("names files legacy-YYYY-MM-DD.html", () => {
    expect(legacyFileName(new Date(2026, 0, 5))).toBe("legacy-2026-01-05.html");
  });

  it("rejects relative paths", () => {
    expect(() => validateDir("exports")).toThrow("notAbsolute");
    expect(() => validateDir("  ")).toThrow();
  });

  it("creates the folder, keeps the newest 6 and leaves other files alone", () => {
    const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "legacy-")), "nested");
    try {
      for (let d = 1; d <= 8; d++) writeLegacyFile(dir, `<p>${d}</p>`, new Date(2026, 2, d));
      fs.writeFileSync(path.join(dir, "notes.html"), "x");
      fs.writeFileSync(path.join(dir, "legacy-2020-01-01.html.bak"), "x");
      writeLegacyFile(dir, "<p>9</p>", new Date(2026, 2, 9));
      const files = fs.readdirSync(dir).sort();
      expect(files.filter((f) => f.endsWith(".html") && f.startsWith("legacy-"))).toEqual(
        [4, 5, 6, 7, 8, 9].map((d) => `legacy-2026-03-0${d}.html`)
      );
      expect(files).toContain("notes.html");
      expect(files).toContain("legacy-2020-01-01.html.bak");
      expect(fs.readFileSync(path.join(dir, "legacy-2026-03-09.html"), "utf8")).toBe("<p>9</p>");
    } finally {
      fs.rmSync(path.dirname(dir), { recursive: true, force: true });
    }
  });
});
