import "server-only";

import { getDb } from "@/server/db/index";
import { getGlobalSetting, setGlobalSetting } from "@/server/db/queries/settings";
import { isOnboardingStep, type OnboardingStep } from "@/lib/onboarding";

const KEY = "onboarding_step";

/** Where first-run onboarding stands: a step to resume, or null when it is finished, skipped, or never needed. */
export function onboardingStep(): OnboardingStep | null {
  const stored = getGlobalSetting(KEY);
  if (stored === "complete") return null;
  if (isOnboardingStep(stored)) return stored;
  // Never started: only a brand-new install goes through it; people who already have data are never pushed in.
  const row = getDb().prepare("SELECT EXISTS(SELECT 1 FROM bank_credentials) OR EXISTS(SELECT 1 FROM transactions) AS has").get() as { has: number };
  return row.has ? null : "welcome";
}

/** A step to resume from, or "complete" (finished or skipped). */
export function setOnboardingStep(step: OnboardingStep | "complete"): void {
  setGlobalSetting(KEY, step);
}
