import fs from "node:fs";
import path from "node:path";

// Resolve the system helpers these scripts spawn to absolute paths.
//
// Everything here runs as the logged-in user, but resolving a tool through PATH lets a
// writable directory earlier in PATH shadow it (Sonar S4036). Fixed system locations win;
// the bare name is kept only as a last resort for unusual installs.
const WINDIR = process.env.SystemRoot ?? "C:\\Windows";
const SYSTEM32 = path.join(WINDIR, "System32");

const CANDIDATES = {
  sudo: ["/usr/bin/sudo"],
  cp: ["/bin/cp", "/usr/bin/cp"],
  which: ["/usr/bin/which", "/bin/which"],
  systemctl: ["/usr/bin/systemctl", "/bin/systemctl"],
  ss: ["/usr/bin/ss", "/bin/ss", "/usr/sbin/ss"],
  journalctl: ["/usr/bin/journalctl", "/bin/journalctl"],
  tail: ["/usr/bin/tail", "/bin/tail"],
  lsof: ["/usr/sbin/lsof", "/usr/bin/lsof"],
  open: ["/usr/bin/open"],
  osascript: ["/usr/bin/osascript"],
  launchctl: ["/bin/launchctl", "/usr/bin/launchctl"],
  "xdg-open": ["/usr/bin/xdg-open", "/usr/local/bin/xdg-open"],
  taskkill: [path.join(SYSTEM32, "taskkill.exe")],
  schtasks: [path.join(SYSTEM32, "schtasks.exe")],
  net: [path.join(SYSTEM32, "net.exe")],
  netstat: [path.join(SYSTEM32, "netstat.exe")],
  ipconfig: [path.join(SYSTEM32, "ipconfig.exe")],
  where: [path.join(SYSTEM32, "where.exe")],
  cmd: [path.join(SYSTEM32, "cmd.exe")],
};

/** Absolute path to a system tool when it exists, otherwise the bare name. */
export function systemBin(name) {
  for (const candidate of CANDIDATES[name] ?? []) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  return name;
}
