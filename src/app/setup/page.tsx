import { redirect } from "next/navigation";
import { SetupWizard } from "@/components/setup/setup-wizard";
import { onboardingStep } from "@/server/lib/onboarding";

export const dynamic = "force-dynamic";

interface SetupPageProps {
  searchParams: Promise<{ force?: string; mode?: string }>;
}

export default async function SetupPage({ searchParams }: SetupPageProps) {
  const { force, mode } = await searchParams;

  if (mode === "new-workspace") return <SetupWizard mode="new-workspace" />;

  // force=1 re-opens it from Settings or Help; otherwise only while onboarding is due.
  const step = onboardingStep();
  if (!step && force !== "1") redirect("/");

  // Re-opened by choice: start over and don't save progress, so leaving half way never pulls Home back here.
  if (force === "1") return <SetupWizard mode="first-run" />;
  return <SetupWizard mode="first-run" initialStep={step ?? "welcome"} resumable />;
}
