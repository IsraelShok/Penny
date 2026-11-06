"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { markProfileChosen, profileChosen } from "@/components/layout/workspace-switcher";
import { listWorkspaces } from "@/lib/api";
import type { Workspace } from "@/lib/types";

/** With 2+ profiles, sends the first visit of a browser session to "who's using?". */
export function ProfileGate() {
  const router = useRouter();
  const { data: profiles = [] } = useQuery<Workspace[]>({
    queryKey: ["workspaces"],
    queryFn: listWorkspaces,
    staleTime: 60_000,
  });
  useEffect(() => {
    // Marked on redirect (not on pick) so leaving /profiles never loops back.
    if (profiles.length >= 2 && !profileChosen()) {
      markProfileChosen();
      router.replace("/profiles");
    }
  }, [profiles.length, router]);
  return null;
}
