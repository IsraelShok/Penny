#!/usr/bin/env node
// One-shot setup: build Next, install the always-on service, open the dashboard.
//
// The desktop app (desktop/, Electron) is shipped as an installer; build it
// locally with `npm run desktop:build` if you want it.
//
// Platform paths:
//   macOS   -> LaunchAgent + open the dashboard
//   Windows -> Task Scheduler + Startup-free web app, open the dashboard
//   Linux   -> systemd user unit, open the dashboard

import { spawnSync } from "node:child_process";
import { systemBin } from "./lib/system-bin.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..");
const SERVICE_INSTALL = path.join(HERE, "service", "install.mjs");
const FRIENDLY_URL = "http://penny.localhost:41234";
const NPM = process.platform === "win32" ? "npm.cmd" : "npm";

function step(msg) {
  console.log(`\n=> ${msg}`);
}

function done(msg) {
  console.log(`   ${msg}`);
}

function fail(msg) {
  console.error(`\nsetup: ${msg}`);
  process.exit(1);
}

function run(cmd, args, opts = {}) {
  // Node v20.12.2+ rejects direct spawning of .cmd/.bat on Windows with EINVAL
  // (CVE-2024-27980 mitigation). Use shell:true for those; args here are
  // hardcoded so the usual injection risk does not apply.
  const needsShell = process.platform === "win32" && /\.(cmd|bat)$/i.test(cmd);
  const r = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: needsShell,
    ...opts,
  });
  if (r.error) {
    throw new Error(`\`${cmd} ${args.join(" ")}\` failed to launch: ${r.error.message}`);
  }
  if (r.status !== 0) {
    const sig = r.signal ? ` (signal: ${r.signal})` : "";
    throw new Error(`\`${cmd} ${args.join(" ")}\` exited with status ${r.status}${sig}`);
  }
}

function preflight() {
  if (!fs.existsSync(path.join(REPO_ROOT, "node_modules", "next"))) {
    fail(
      "Dependencies not installed. Run this first:\n" +
        "  npm install\n" +
        "Then re-run `npm run setup`.",
    );
  }

  if (process.platform === "win32") {
    // Hosts file edit needs Administrator on Windows, but setup itself does
    // not. If the shell is not elevated, warn (so the user knows why
    // penny.localhost may not resolve on older Windows) and keep going. The
    // web app at 127.0.0.1 works regardless.
    const r = spawnSync(systemBin("net"), ["session"], { encoding: "utf-8" });
    if (r.status !== 0) {
      console.log("");
      console.log("Note: this shell is not Administrator.");
      console.log("Setup will continue, but the hosts entry for penny.localhost cannot be added.");
      console.log("  - http://127.0.0.1:41234 will work normally.");
      console.log("  - http://penny.localhost:41234 may not resolve on older Windows builds.");
      console.log("To guarantee the friendly hostname, relaunch from an elevated");
      console.log("PowerShell (Win+X -> 'Terminal (Admin)') and run `npm run service:install`.");
      console.log("");
    }
  }
}

function windowsHostsHasPennyLocalhost() {
  const hostsPath = `${process.env.SystemRoot ?? "C:\\Windows"}\\System32\\drivers\\etc\\hosts`;
  try {
    const content = fs.readFileSync(hostsPath, "utf-8");
    return /^[^#\n]*\b127\.0\.0\.1\b[^\n]*\bpenny\.localhost\b/m.test(content);
  } catch {
    return false;
  }
}

function dashboardUrl() {
  // macOS and Linux resolve *.localhost natively (no hosts file needed).
  // On Windows, fall back to loopback if the hosts entry wasn't written
  // (e.g. user didn't run setup from an elevated shell).
  if (process.platform !== "win32") return FRIENDLY_URL;
  return windowsHostsHasPennyLocalhost() ? FRIENDLY_URL : "http://127.0.0.1:41234";
}

function buildNextApp() {
  step("Building Next.js app");
  run(NPM, ["run", "build"], { cwd: REPO_ROOT });
}

function installService() {
  step("Installing background service");
  run(process.execPath, [SERVICE_INSTALL, "install"], { cwd: REPO_ROOT });
}

// launchctl/schtasks/systemctl all return as soon as the job is registered,
// not when `next start` is actually listening. Poll /api/health so the
// browser-open at the end of setup doesn't beat the server to the punch.
async function waitForServer(maxMs = 60000) {
  const url = "http://127.0.0.1:41234/api/health";
  const start = Date.now();
  let lastErr = null;
  while (Date.now() - start < maxMs) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (r.ok) {
        const data = await r.json().catch(() => ({}));
        if (data && data.ok === true) return true;
      }
    } catch (err) {
      lastErr = err;
    }
    await new Promise((res) => setTimeout(res, 500));
  }
  if (lastErr) {
    console.error(`   last error while polling: ${lastErr.message ?? lastErr}`);
  }
  return false;
}

function openDashboard() {
  step("Opening dashboard");
  const url = dashboardUrl();
  if (process.platform === "darwin") spawnSync(systemBin("open"), [url], { stdio: "ignore" });
  else if (process.platform === "win32")
    spawnSync(systemBin("cmd"), ["/c", "start", "", url], { stdio: "ignore" });
  else spawnSync(systemBin("xdg-open"), [url], { stdio: "ignore" });
}

async function main() {
  console.log("Penny setup");
  console.log(`  platform: ${process.platform}`);
  console.log(`  repo:     ${REPO_ROOT}`);

  preflight();
  buildNextApp();
  installService();

  step("Waiting for server to come up");
  const ready = await waitForServer();
  if (ready) {
    done("server is healthy");
  } else {
    console.error("   server did not respond within 60s, continuing anyway.");
    console.error(`   check logs: npm run service:logs`);
  }

  if (
    process.platform !== "darwin" &&
    process.platform !== "win32" &&
    process.platform !== "linux"
  ) {
    fail(`unsupported platform: ${process.platform}`);
  }

  openDashboard();
  printCheatSheet();
}

function printCheatSheet() {
  const url = dashboardUrl();
  console.log("");
  console.log("================================================================");
  console.log(`  Done. Penny is at ${url}`);
  if (url !== FRIENDLY_URL) {
    console.log(`  (${FRIENDLY_URL} would also work once the hosts entry is in place.)`);
  }
  console.log("================================================================");
  console.log("");
  console.log("Useful commands:");
  console.log("  npm run service:status         see if the service is running");
  console.log("  npm run service:start          start the background service");
  console.log("  npm run service:stop           stop the background service");
  console.log("  npm run service:reload         rebuild and restart (after code edits)");
  console.log("  npm run service:logs           tail the server logs");
  console.log("  npm run service:open           open the dashboard in your browser");
  console.log("  npm run desktop:build          build the desktop app from source");
  console.log("  npm run uninstall              remove the service and old desktop installs");
  console.log("");
  console.log("Tip: bookmark the URL above so the daily flow is one click.");
  console.log("");
}

main().catch((err) => {
  fail(err instanceof Error ? err.message : String(err));
});
