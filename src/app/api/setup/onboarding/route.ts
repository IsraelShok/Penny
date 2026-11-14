import { NextResponse } from "next/server";
import { isOnboardingStep } from "@/lib/onboarding";
import { setOnboardingStep } from "@/server/lib/onboarding";

/** Saves where onboarding stands: { step } to resume there, or { step: "complete" } once finished or skipped. */
export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as { step?: unknown } | null;
  const step = body?.step;
  if (step !== "complete" && !isOnboardingStep(step)) return NextResponse.json({ error: "invalid step" }, { status: 400 });
  setOnboardingStep(step);
  return NextResponse.json({ success: true });
}
