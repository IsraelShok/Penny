/** Concepts with a "what is this?" explanation, in help-page order. */
export const CONCEPTS = ["free", "pace", "forecast", "budget", "resilience"] as const;
export type Concept = (typeof CONCEPTS)[number];

/** Pages with a one-line purpose (i18n key under "purpose"); a sub-page uses its section's line. */
const PAGES = ["budget", "transactions", "overview", "insights", "investments", "fi", "life", "recap", "ask", "journey", "more", "wellbeing", "markets", "rules", "settings", "help"] as const;

export function pagePurposeKey(pathname: string): string | null {
  const first = pathname.split("/")[1];
  return (PAGES as readonly string[]).includes(first) ? first : null;
}
