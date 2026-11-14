import "server-only";

import fs from "fs";
import os from "os";
import path from "path";
import { dataDir } from "./data-dir";

/**
 * Phone access on the home network. The flag is a file in the data dir so the launchers
 * (scripts/serve.mjs, desktop/main.cjs) can read it before the server starts and bind 0.0.0.0.
 */
export const LAN_FLAG = "lan-access.json";
const flagPath = () => path.join(dataDir(), LAN_FLAG);

export function isLanEnabled(): boolean {
  return fs.existsSync(flagPath());
}

export function setLanEnabled(on: boolean): void {
  if (on) fs.writeFileSync(flagPath(), JSON.stringify({ enabled: true }), { mode: 0o600 });
  else fs.rmSync(flagPath(), { force: true });
}

/** Private IPv4 addresses of this machine, for the phone URL. */
export function lanAddresses(): string[] {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((i): i is os.NetworkInterfaceInfo => !!i && i.family === "IPv4" && !i.internal)
    .map((i) => i.address)
    .filter((a) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a));
}
