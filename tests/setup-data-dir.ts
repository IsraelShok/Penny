import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// A test that does not pick a data folder would otherwise open ./data, which on a developer's machine
// is their real database and key. Each test file that sets PENNY_DATA_DIR itself still wins.
if (!process.env.PENNY_DATA_DIR)
  process.env.PENNY_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "penny-test-"));
