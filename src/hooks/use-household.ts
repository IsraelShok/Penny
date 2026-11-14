"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { getSettings, updateSettings } from "@/lib/api";
import { EMPTY_HOUSEHOLD, type Household } from "@/lib/household";

export function useHousehold() {
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const household = query.data?.household ?? EMPTY_HOUSEHOLD;

  const mutation = useMutation({
    mutationFn: (h: Household) => updateSettings({ household: h }),
    // Optimistic, so a switch or picker moves at once; a failure puts the old value back.
    onMutate: (h) => {
      const before = queryClient.getQueryData(["settings"]);
      queryClient.setQueryData<{ household?: Household }>(["settings"], (old) => (old ? { ...old, household: h } : old));
      return { before };
    },
    onSuccess: (data) => { queryClient.setQueryData(["settings"], data); toast.success(tCommon("saved")); },
    onError: (err, _h, ctx) => {
      if (ctx) queryClient.setQueryData(["settings"], ctx.before);
      toast.error(err instanceof Error ? err.message : tCommon("tryAgain"));
    },
  });

  const save = (patch: Partial<Household>, opts?: { onSuccess?: () => void }) => mutation.mutate({ ...household, ...patch }, opts);
  return { household, loading: query.isLoading, failed: query.isError, save, saving: mutation.isPending };
}
