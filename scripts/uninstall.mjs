#!/usr/bin/env node
// Mirror of setup.mjs: tear down everything `npm run setup` installed.
// The data/ directory and the repo itself are deliberately NOT touched:
// uninstall is about removing the always-on service and older desktop-app
// installs, not the user's transactions and encryption key.

import { spawnSync } from "node:child_process";
import { systemBin } from "./lib/system-bin.mjs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..");
const SERVICE_INSTALL = path.join(HERE, "service", "install.mjs");

function step(msg) {
  console.log(`\n=> ${msg}`);
}

function done(msg) {
  console.log(`   ${msg}`);
}

// Uninstall is best-effort: missing pieces are not errors, they're already-gone.
function tryRun(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { stdio: "ignore", ...opts });
}

function uninstallService() {
  step("Removing background service");
  const r = spawnSync(process.execPath, [SERVICE_INSTALL, "uninstall"], {
    cwd: REPO_ROOT,
    stdio: "inherit",
  });
  if (r.status !== 0) {
    console.error(`   service uninstaller exited with status ${r.status}, continuing`);
  }
}

export async function macUninstall(name = "Penny") {
  step(`Quitting ${name} desktop app (if running)`);
  tryRun("osascript", ["-e", `tell application "${name}" to quit`]);
  // Give the GUI app a moment to flush and exit before we remove its bundle.
  await new Promise((r) => setTimeout(r, 500));
  done("done");

  step(`Removing ~/Applications/${name}.app`);
  const appPath = path.join(os.homedir(), "Applications", `${name}.app`);
  if (fs.existsSync(appPath)) {
    fs.rmSync(appPath, { recursive: true, force: true });
    done("removed");
  } else {
    done("not present");
  }

  step("Removing Login Item");
  const r = spawnSync(
    systemBin("osascript"),
    ["-e", `tell application "System Events" to delete (every login item whose name is "${name}")`],
    { encoding: "utf-8" },
  );
  if (r.status === 0) {
    done("removed");
  } else {
    done("nothing to remove (or System Events refused)");
  }
}

export function windowsUninstall(name = "Penny") {
  step(`Stopping ${name} desktop app (if running)`);
  tryRun("taskkill", ["/IM", `${name}.exe`, "/F"]);
  done("done");

  step(`Removing %LOCALAPPDATA%\\Programs\\${name}`);
  const localAppData = process.env.LOCALAPPDATA;
  if (localAppData) {
    const installDir = path.join(localAppData, "Programs", name);
    if (fs.existsSync(installDir)) {
      try {
        fs.rmSync(installDir, { recursive: true, force: true });
        done("removed");
      } catch (err) {
        console.error(`   could not remove: ${err.message}`);
        console.error(`   close any open ${name} windows and retry.`);
      }
    } else {
      done("not present");
    }
  } else {
    console.error("   LOCALAPPDATA env var is not set; skipping.");
  }

  step("Removing Startup shortcut");
  const appData = process.env.APPDATA;
  if (appData) {
    const shortcutPath = path.join(
      appData,
      "Microsoft",
      "Windows",
      "Start Menu",
      "Programs",
      "Startup",
      `${name}.lnk`,
    );
    if (fs.existsSync(shortcutPath)) {
      fs.unlinkSync(shortcutPath);
      done("removed");
    } else {
      done("not present");
    }
  } else {
    console.error("   APPDATA env var is not set; skipping.");
  }
}

function linuxUninstall() {
  step("Linux: no desktop app to remove (web-only platform)");
}

async function main() {
  console.log("Penny uninstall");
  console.log(`  platform: ${process.platform}`);
  console.log(`  repo:     ${REPO_ROOT}`);

  uninstallService();

  switch (process.platform) {
    case "darwin":
      await macUninstall();
      await macUninstall("Spent"); // legacy: Spent.app from installs before the Penny rename
      break;
    case "win32":
      windowsUninstall();
      windowsUninstall("Spent"); // legacy: Spent.exe and Spent.lnk from installs before the Penny rename
      break;
    case "linux":
      linuxUninstall();
      break;
  }

  const dataDir = path.join(REPO_ROOT, "data");
  console.log("");
  console.log("Penny is uninstalled. Service and old desktop installs are gone.");
  console.log("");
  console.log("Kept (intentionally):");
  console.log(`  ${dataDir}  (your transactions + encryption key)`);
  console.log(`  ${REPO_ROOT}  (the repo itself)`);
  console.log("");
  console.log("To wipe everything, delete those directories manually.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((err) => {
    console.error(`\nuninstall: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
