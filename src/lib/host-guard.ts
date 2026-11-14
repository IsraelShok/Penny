// The app serves localhost by default. Rejecting any other Host header defeats DNS rebinding,
// where a hostile site's name is pointed at 127.0.0.1 so the browser treats this app as same-origin.
// Self-hosters who reach the app by another name (home server, LAN IP) list it in PENNY_ALLOWED_HOSTS.
import { pennyEnv } from "./legacy-names";
const ALLOWED = new Set(["127.0.0.1", "localhost", "[::1]", "penny.localhost", "spent.localhost"]); // legacy: spent.localhost from installs before the Penny rename

const fromEnv = (pennyEnv("ALLOWED_HOSTS") ?? "")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean)
  .map((h) => (h.includes(":") && !h.startsWith("[") ? `[${h}]` : h));

export function isAllowedHost(host: string | null, extra: string[] = fromEnv): boolean {
  if (!host) return false;
  const name = (host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : host.split(":")[0]).toLowerCase();
  const listed = extra.map((h) => {
    const lower = h.toLowerCase();
    return lower.includes(":") && !lower.startsWith("[") ? `[${lower}]` : lower;
  });
  return ALLOWED.has(name) || listed.includes(name);
}
