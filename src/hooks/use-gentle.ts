"use client";

import { useHousehold } from "@/hooks/use-household";

/** True when the household turned on gentle mode: fewer numbers, no comparisons, softer copy. */
export function useGentle(): boolean {
  return useHousehold().household.gentleMode;
}
