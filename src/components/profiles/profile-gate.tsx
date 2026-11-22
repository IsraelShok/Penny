"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  markProfileChosen,
  profileChosen,
  useProfiles,
} from "@/components/layout/workspace-switcher";

/** With 2+ profiles, sends the first visit of a browser session to "who's using?". */
export function ProfileGate() {
  const router = useRouter();
  const { profiles } = useProfiles();
  useEffect(() => {
    // Marked on redirect (not on pick) so leaving /profiles never loops back.
    if (profiles.length >= 2 && !profileChosen()) {
      markProfileChosen();
      router.replace("/profiles");
    }
  }, [profiles.length, router]);
  return null;
}
