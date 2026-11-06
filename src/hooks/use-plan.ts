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
    mutationFn: (patch: Partial<FinancialPlan>) => savePlan({ ...plan, ...patch }),
    onSuccess: () => {
      ["plan", "overview"].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
    },
  });
  return { plan, loaded: query.isSuccess, failed: query.isError, retry: query.refetch, update: mutation.mutateAsync, saving: mutation.isPending };
}
