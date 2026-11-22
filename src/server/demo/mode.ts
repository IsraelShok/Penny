/**
 * Demo mode runs the whole app on a made-up household in its own data folder
 * (PENNY_DATA_DIR), so nothing real is read or written. It is opt-in through
 * PENNY_DEMO=1; the scripts in scripts/demo.mjs set it.
 * On Vercel it is always on: a public host must never hold a real household's data.
 */
export function isDemoMode(env: Record<string, string | undefined> = process.env): boolean {
  if (isHostedDemo(env)) return true;
  const value = env.PENNY_DEMO?.trim().toLowerCase();
  return value === "1" || value === "true";
}

/** Shown when the demo is asked to do anything that would leave the machine. */
/** Running on Vercel (the public demo). */
export const isHostedDemo = (env: Record<string, string | undefined> = process.env) => !!env.VERCEL;

export const DEMO_BLOCKED_MESSAGE =
  "מצב דמו: הפעולה כבויה והנתונים כאן הם לדוגמה. (Demo mode: this action is off and this household is sample data.)";
