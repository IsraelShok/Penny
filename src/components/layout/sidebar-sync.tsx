"use client";

import { useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { SyncButton } from "@/components/dashboard/sync-button";

/** Sync now (which also categorizes). Lives in Settings › Banks; "?sync=1" (onboarding, the stale-data nudge) starts it right away. */
export function SyncActions() {
  const queryClient = useQueryClient();
  const autoStart = useSearchParams().get("sync") === "1";
  // Everything on screen can change after a sync or a categorize run.
  const refresh = useCallback(() => queryClient.invalidateQueries(), [queryClient]);
  return (
    // Sync also categorizes new transactions, so there is no separate categorize button.
    <SyncButton onComplete={refresh} autoStart={autoStart} showLabel={false} />
  );
}
