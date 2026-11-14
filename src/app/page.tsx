import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { HomePage } from "@/components/home/home-page";
import { ProfileGate } from "@/components/profiles/profile-gate";
import { onboardingStep } from "@/server/lib/onboarding";

export const dynamic = "force-dynamic";

export default function Home() {
  // A new install (or one that stopped half way) goes to first-run onboarding; it can be skipped from there.
  if (onboardingStep()) redirect("/setup");
  return (
    <AppShell>
      <ProfileGate />
      <HomePage />
    </AppShell>
  );
}
