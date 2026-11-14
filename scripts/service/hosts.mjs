import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { HOST, FRIENDLY_HOST } from "./paths.mjs";

const MARKER_START = "# >>> penny (managed) >>>";
const MARKER_END = "# <<< penny <<<";
// legacy: "spent" hosts block and spent.localhost from installs before the Penny rename
const LEGACY_START = "# >>> spent (managed) >>>";
const LEGACY_END = "# <<< spent <<<";
const LEGACY_HOST = "spent.localhost";
const MANAGED_LINE = `${HOST}\t${FRIENDLY_HOST} ${LEGACY_HOST}`;

export function hostsFilePath() {
  if (process.platform === "win32") {
    const sysroot = process.env.SystemRoot ?? "C:\\Windows";
    return path.join(sysroot, "System32", "drivers", "etc", "hosts");
  }
  return "/etc/hosts";
}

function buildManagedBlock() {
  return [
    MARKER_START,
    `# Added by Penny (scripts/service). Resolves ${FRIENDLY_HOST} to loopback.`,
    "# Do not edit between markers; `npm run service:uninstall` removes them.",
    MANAGED_LINE,
    MARKER_END,
  ].join(os.EOL);
}

function hasAnyBlock(content) {
  return content.includes(MARKER_START) || content.includes(LEGACY_START);
}

function stripBlock(content, startMarker, endMarker) {
  const start = content.indexOf(startMarker);
  if (start === -1) return content;
  const end = content.indexOf(endMarker);
  if (end === -1) return content;
  return content.slice(0, start) + content.slice(end + endMarker.length);
}

function stripManagedBlock(content) {
  if (!hasAnyBlock(content)) return content;
  let trimmed = stripBlock(stripBlock(content, MARKER_START, MARKER_END), LEGACY_START, LEGACY_END);
  trimmed = trimmed.replace(/\n{3,}/g, "\n\n");
  if (!trimmed.endsWith(os.EOL)) trimmed += os.EOL;
  return trimmed;
}

function readCurrent() {
  const p = hostsFilePath();
  if (!fs.existsSync(p)) return { path: p, content: "" };
  return { path: p, content: fs.readFileSync(p, "utf-8") };
}

export function hasManagedBlock() {
  const { content } = readCurrent();
  return hasAnyBlock(content);
}

function writeWithPrivilege(targetPath, newContent) {
  if (process.platform === "win32") {
    return writeWindows(targetPath, newContent);
  }
  return writeUnix(targetPath, newContent);
}

function writeUnix(targetPath, newContent) {
  const tmp = path.join(os.tmpdir(), `penny-hosts-${process.pid}.tmp`);
  fs.writeFileSync(tmp, newContent, { mode: 0o644 });
  try {
    console.log(`Updating ${targetPath} (requires sudo for this step only).`);
    const r = spawnSync("sudo", ["cp", tmp, targetPath], { stdio: "inherit" });
    if (r.status !== 0) {
      throw new Error(
        `sudo cp failed (exit ${r.status}). Hosts file not modified.`,
      );
    }
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      // best-effort cleanup
    }
  }
}

function writeWindows(targetPath, newContent) {
  try {
    fs.writeFileSync(targetPath, newContent);
    return;
  } catch (err) {
    throw new Error(
      `Cannot write ${targetPath}: ${(err instanceof Error ? err.message : err)}.\n` +
        "Re-run this command from an Administrator PowerShell:\n" +
        '  Start-Process powershell -Verb RunAs -ArgumentList "-NoExit","-Command","cd \\"' +
        process.cwd() +
        '\\"; npm run service:install"',
    );
  }
}

// A block written before the rename (any hostname under the old markers) needs migration.
function hasLegacyLocalBlock(content) {
  return content.includes(LEGACY_START);
}

function hasCurrentBlock(content) {
  if (!content.includes(MARKER_START)) return false;
  const start = content.indexOf(MARKER_START);
  const end = content.indexOf(MARKER_END);
  if (end === -1) return false;
  const block = content.slice(start, end + MARKER_END.length);
  return block.includes(MANAGED_LINE);
}

export function addManagedBlock() {
  const { path: p, content } = readCurrent();
  const isWindows = process.platform === "win32";
  const legacy = hasLegacyLocalBlock(content);

  if (!isWindows) {
    // macOS and Linux resolve *.localhost natively (macOS via the system
    // resolver, Linux via nsswitch `myhostname`). No hosts entry needed.
    // If an old managed block is still present, strip it so the old
    // hostname stops resolving (avoids stale bookmarks hitting a slow mDNS
    // detour or the now-wrong loopback line).
    if (!hasAnyBlock(content)) {
      return false;
    }
    if (legacy) {
      console.log(
        "Removing the old hosts entry (no longer needed on this OS; *.localhost resolves natively).",
      );
    }
    const newContent = stripManagedBlock(content);
    writeWithPrivilege(p, newContent);
    return true;
  }

  // Windows: write/refresh the managed block.
  if (hasCurrentBlock(content)) {
    console.log(`Hosts file already has the penny block. No changes.`);
    return false;
  }

  const stripped = stripManagedBlock(content);
  const block = buildManagedBlock();
  const base = stripped.endsWith("\n") || stripped === "" ? stripped : stripped + os.EOL;
  const newContent = base + block + os.EOL;

  if (legacy) {
    console.log(`Migrating the old hosts entry to ${FRIENDLY_HOST}.`);
  } else {
    console.log(`Will append these lines to ${p}:`);
    console.log("---");
    console.log(block);
    console.log("---");
  }

  writeWithPrivilege(p, newContent);
  return true;
}

export function removeManagedBlock() {
  const { path: p, content } = readCurrent();
  if (!hasAnyBlock(content)) {
    console.log(`No penny block found in ${p}. Nothing to remove.`);
    return false;
  }

  const newContent = stripManagedBlock(content);
  writeWithPrivilege(p, newContent);
  return true;
}
