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
    onSuccess: (data) => queryClient.setQueryData(["settings"], data),
    onError: (err) => toast.error(err instanceof Error ? err.message : tCommon("tryAgain")),
  });

  const save = (patch: Partial<Household>) => mutation.mutate({ ...household, ...patch });
  return { household, loading: query.isLoading, save, saving: mutation.isPending };
}
