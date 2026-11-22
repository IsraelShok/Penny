import "server-only";

import { getDb } from "../db/index";
import { normalizeMerchant } from "../rules/normalize";

/** A description is generic when its normalized text contains one of the person's generic patterns. */
export function isGeneric(description: string, patterns: string[]): boolean {
  const text = normalizeMerchant(description);
  return patterns.some((p) => p && text.includes(p));
}

export function listGenericPatterns(workspaceId: number): string[] {
  return (
    getDb()
      .prepare("SELECT pattern FROM generic_descriptions WHERE workspace_id=? ORDER BY pattern")
      .all(workspaceId) as { pattern: string }[]
  ).map((r) => r.pattern);
}

/** Stores the normalized pattern; returns it, or null when nothing is left after normalizing. */
export function addGenericPattern(workspaceId: number, raw: string): string | null {
  const pattern = normalizeMerchant(raw);
  if (!pattern || pattern.length > 80) return null;
  getDb()
    .prepare("INSERT OR IGNORE INTO generic_descriptions (workspace_id, pattern) VALUES (?, ?)")
    .run(workspaceId, pattern);
  return pattern;
}

export function removeGenericPattern(workspaceId: number, pattern: string): void {
  getDb()
    .prepare("DELETE FROM generic_descriptions WHERE workspace_id=? AND pattern=?")
    .run(workspaceId, pattern);
}
