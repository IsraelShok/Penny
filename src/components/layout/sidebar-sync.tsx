"use client";

import { useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { CategorizeButton } from "@/components/dashboard/categorize-button";
import { SyncButton } from "@/components/dashboard/sync-button";

/** Sync now + auto-categorize. Lives in Settings › Banks; "?sync=1" (onboarding, the stale-data nudge) starts it right away. */
export function SyncActions() {
  const queryClient = useQueryClient();
  const autoStart = useSearchParams().get("sync") === "1";
  // Everything on screen can change after a sync or a categorize run.
  const refresh = useCallback(() => queryClient.invalidateQueries(), [queryClient]);
  return (
    <>
      <CategorizeButton onApplied={refresh} />
      <SyncButton onComplete={refresh} autoStart={autoStart} />
    </>
  );
}
