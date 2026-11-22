/** First-run onboarding, in order. The global setting holds the current step (resume) or "done". */
export const ONBOARDING_STEPS = [
  "welcome",
  "profile",
  "connect",
  "target",
  "budgets",
  "ai",
  "tour",
  "done",
] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const isOnboardingStep = (v: unknown): v is OnboardingStep =>
  (ONBOARDING_STEPS as readonly unknown[]).includes(v);
