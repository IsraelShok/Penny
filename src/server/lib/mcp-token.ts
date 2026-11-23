import "server-only";

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { dataDir } from "./data-dir";
import { writeOwnerOnly } from "./encryption";

/**
 * The secret scripts/mcp.mjs sends so its read-only calls pass the app lock (see lockGate in
 * src/proxy.ts). It sits in the data folder: whoever can read it can already read the database.
 */
export const MCP_TOKEN_HEADER = "x-penny-mcp-token";

export const mcpTokenPath = () => path.join(dataDir(), "mcp-token");

export function getOrCreateMcpToken(): string {
  const file = mcpTokenPath();
  try {
    const saved = fs.readFileSync(file, "utf8").trim();
    if (/^[0-9a-f]{64}$/.test(saved)) return saved;
  } catch {
    // No file yet.
  }
  const token = crypto.randomBytes(32).toString("hex");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  writeOwnerOnly(file, token);
  return token;
}

/** Also writes the token file when it is missing, so the MCP server finds it on its next call. */
export function isMcpToken(value: string | null | undefined): boolean {
  let token: string;
  try {
    token = getOrCreateMcpToken();
  } catch {
    return false; // a data folder that cannot be written must not break the lock screen
  }
  if (!value) return false;
  const given = Buffer.from(value);
  const expected = Buffer.from(token);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}
