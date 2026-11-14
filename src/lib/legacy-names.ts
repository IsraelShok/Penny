/** Reads PENNY_<name>, falling back to the variable older installs set. */
export function pennyEnv(name: string, env: Record<string, string | undefined> = process.env): string | undefined {
  return env[`PENNY_${name}`] ?? env[`SPENT_${name}`]; // legacy: SPENT_* env vars from installs before the Penny rename
}

/** Reads a localStorage value, falling back to the key older installs wrote. */
export function readStored(key: string, legacyKey: string): string | null {
  try {
    return window.localStorage.getItem(key) ?? window.localStorage.getItem(legacyKey);
  } catch {
    return null;
  }
}
