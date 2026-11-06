"use client";

import { useCallback, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getActivity, getHome } from "@/lib/api";
import { SyncStatusPill } from "@/components/home/sync-status-pill";
import { CategorizeButton } from "@/components/dashboard/categorize-button";
import { SyncButton } from "@/components/dashboard/sync-button";
import { useSidebar } from "@/components/ui/sidebar";

/** Sync status, auto-categorize and sync now: app-wide tools, so they live in the sidebar, not on every page. */
export function SidebarSync() {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  // Onboarding lands on "/?sync=1" to start the first sync.
  const params = useSearchParams();
  const autoStart = pathname === "/" && params.get("sync") === "1";
  const [open, setOpen] = useState(false);
  const { state } = useSidebar();
  const home = useQuery({ queryKey: ["home"], queryFn: getHome });
  const { data: activity } = useQuery({
    queryKey: ["activity"],
    queryFn: getActivity,
    refetchInterval: (q) => (open || q.state.data?.sync.active ? 3000 : 15000),
    refetchIntervalInBackground: false,
  });
  const onOpenChange = useCallback((o: boolean) => {
    setOpen(o);
    if (o) queryClient.invalidateQueries({ queryKey: ["activity"] });
  }, [queryClient]);
  // Everything on screen can change after a sync or a categorize run.
  const refresh = useCallback(() => queryClient.invalidateQueries(), [queryClient]);

  return (
    <div className="flex items-center gap-1 group-data-[collapsible=icon]:flex-col [&>*:last-child]:ms-auto group-data-[collapsible=icon]:[&>*:last-child]:ms-0">
      <SyncStatusPill
        items={home.data?.bankHealth ?? null}
        nextScheduledSync={home.data?.nextScheduledSync ?? null}
        activity={activity ?? null}
        onOpenChange={onOpenChange}
      />
      <CategorizeButton onApplied={refresh} />
      <SyncButton onComplete={refresh} autoStart={autoStart} showLabel={state === "expanded"} />
    </div>
  );
}
