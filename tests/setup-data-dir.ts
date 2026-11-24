import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll } from "vitest";

// A test that does not pick a data folder would otherwise open ./data, which on a developer's machine
// is their real database and key. Each test file that sets PENNY_DATA_DIR itself still wins.
let owned: string | undefined;
if (!process.env.PENNY_DATA_DIR) {
  owned = fs.mkdtempSync(path.join(os.tmpdir(), "penny-test-"));
  process.env.PENNY_DATA_DIR = owned;
}

// Registered first, so it runs after the test file's own afterAll hooks.
afterAll(() => {
  if (!owned) return;
  globalThis._db?.close(); // Windows refuses to delete an open database file
  globalThis._db = undefined;
  try {
    fs.rmSync(owned, { recursive: true, force: true, maxRetries: 3 });
  } catch {
    // A file still held by a test leaves one folder in the temp directory; not worth failing the run.
  }
});
