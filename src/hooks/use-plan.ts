"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getPlan, savePlan } from "@/lib/api";
import { DEFAULT_PLAN, type FinancialPlan } from "@/lib/plan";

/** The plan settings, with defaults while loading, and a patch-style save. */
export function usePlan() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["plan"], queryFn: getPlan });
  const plan = query.data?.plan ?? DEFAULT_PLAN;
  const mutation = useMutation({
    // Before the plan loads, merge onto the stored plan, not DEFAULT_PLAN, so nothing (e.g. homeStyle) is reset.
    mutationFn: async (patch: Partial<FinancialPlan>) => savePlan({ ...(query.data?.plan ?? (await getPlan()).plan), ...patch }),
    onSuccess: () => {
      ["plan", "overview"].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
    },
  });
  return { plan, loaded: query.isSuccess, failed: query.isError, retry: query.refetch, update: mutation.mutateAsync, saving: mutation.isPending };
}
