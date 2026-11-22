import "server-only";

import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { getGlobalSetting, setGlobalSetting } from "@/server/db/queries/settings";
import { isKeyLocked } from "@/server/lib/encryption";

export const LEGACY_KEEP = 6;
const NAME_RE = /^legacy-\d{4}-\d{2}-\d{2}\.html$/;
const DAY = 86_400_000;
const PERIOD = { weekly: 7 * DAY, monthly: 30 * DAY } as const;
export type LegacyFrequency = keyof typeof PERIOD;

export interface LegacyExportConfig {
  enabled: boolean;
  frequency: LegacyFrequency;
  dir: string;
  defaultDir: string;
  lastAt: string | null;
  lastFile: string | null;
  status: "ok" | "locked" | "error" | null;
  error: string | null;
}

export const defaultLegacyDir = () => path.join(os.homedir(), "Documents", "family-document");

/** legacy-YYYY-MM-DD.html for the given local date. */
export function legacyFileName(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `legacy-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.html`;
}

/** Absolute, normalised folder, or an error key. */
export function validateDir(dir: string): string {
  const d = dir.trim();
  if (!d || !path.isAbsolute(d) || d.includes("\0")) throw new Error("notAbsolute");
  return path.resolve(d);
}

/** Writes html into dir (created if missing) and deletes all but the newest `keep` files of our own pattern. */
export function writeLegacyFile(
  dir: string,
  html: string,
  now = new Date(),
  keep = LEGACY_KEEP,
): string {
  const root = validateDir(dir);
  fs.mkdirSync(root, { recursive: true });
  const file = path.join(root, legacyFileName(now));
  if (path.dirname(file) !== root) throw new Error("outside"); // never write outside the chosen folder
  fs.writeFileSync(file, html, "utf8");
  // ISO dates sort lexically; only exact-pattern regular files are ever deleted.
  const ours = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isFile() && NAME_RE.test(e.name))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));
  for (const name of ours.slice(0, Math.max(0, ours.length - keep)))
    fs.unlinkSync(path.join(root, name));
  return file;
}

const KEY = "legacy_export";
const SNAPSHOT = "legacy_export_snapshot";

export function getLegacyExportConfig(): LegacyExportConfig {
  let saved: Partial<LegacyExportConfig> = {};
  try {
    saved = JSON.parse(getGlobalSetting(KEY) ?? "{}");
  } catch {}
  const defaultDir = defaultLegacyDir();
  return {
    enabled: saved.enabled === true,
    frequency: saved.frequency === "weekly" ? "weekly" : "monthly",
    dir: typeof saved.dir === "string" && saved.dir ? saved.dir : defaultDir,
    defaultDir,
    lastAt: saved.lastAt ?? null,
    lastFile: saved.lastFile ?? null,
    status: saved.status ?? null,
    error: saved.error ?? null,
  };
}

function save(c: LegacyExportConfig) {
  const { defaultDir: _d, ...rest } = c;
  setGlobalSetting(KEY, JSON.stringify(rest));
  return getLegacyExportConfig();
}

export function updateLegacyExportConfig(patch: {
  enabled?: boolean;
  frequency?: string;
  dir?: string;
}) {
  const c = getLegacyExportConfig();
  if (patch.enabled !== undefined) c.enabled = patch.enabled === true;
  if (patch.frequency !== undefined)
    c.frequency = patch.frequency === "weekly" ? "weekly" : "monthly";
  if (patch.dir !== undefined) c.dir = validateDir(patch.dir);
  return save(c);
}

/** The page sends its rendered document; kept so the schedule can write it without the page open. */
export function storeLegacySnapshot(html: string) {
  setGlobalSetting(SNAPSHOT, html);
}

/** Writes the latest snapshot now. Locked app → records "locked" instead of failing. */
export function runLegacyExport(): LegacyExportConfig {
  const c = getLegacyExportConfig();
  if (isKeyLocked()) return save({ ...c, status: "locked", error: null });
  const html = getGlobalSetting(SNAPSHOT);
  if (!html) return save({ ...c, status: "error", error: "noSnapshot" });
  try {
    const file = writeLegacyFile(c.dir, html);
    return save({
      ...c,
      lastAt: new Date().toISOString(),
      lastFile: file,
      status: "ok",
      error: null,
    });
  } catch (e) {
    return save({
      ...c,
      status: "error",
      error: e instanceof Error ? e.message.slice(0, 200) : "failed",
    });
  }
}

export function openLegacyFolder() {
  const dir = validateDir(getLegacyExportConfig().dir);
  fs.mkdirSync(dir, { recursive: true });
  const cmd =
    process.platform === "win32" ? "explorer" : process.platform === "darwin" ? "open" : "xdg-open";
  spawn(cmd, [dir], { detached: true, stdio: "ignore" })
    .on("error", () => {})
    .unref();
}

declare global {
  var __legacyExportTimer: ReturnType<typeof setInterval> | undefined;
}

/** Hourly check beside the sync scheduler: exports when the chosen period has passed since the last good export. */
export function initLegacyExportSchedule() {
  if (globalThis.__legacyExportTimer) clearInterval(globalThis.__legacyExportTimer);
  const tick = () => {
    try {
      const c = getLegacyExportConfig();
      if (!c.enabled || !getGlobalSetting(SNAPSHOT)) return;
      if (c.lastAt && Date.now() - Date.parse(c.lastAt) < PERIOD[c.frequency]) return;
      runLegacyExport();
    } catch (e) {
      console.error("[legacy-export] tick failed:", e instanceof Error ? e.message : e);
    }
  };
  globalThis.__legacyExportTimer = setInterval(tick, 3_600_000);
  globalThis.__legacyExportTimer.unref?.();
  tick();
}
