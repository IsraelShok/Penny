/** Reads the PENNY_<name> environment variable. */
export function pennyEnv(
  name: string,
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  return env[`PENNY_${name}`];
}
