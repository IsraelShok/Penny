"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { deletePlanItem, savePlanItem } from "@/lib/api";

type Kind = "goal" | "policy" | "netWorth";

/**
 * Delete at once and offer Undo in a toast, instead of asking "are you sure?" first.
 * Undo saves the same item again (as a new row).
 */
export function useUndoableDelete<T extends Record<string, unknown>>(
  kind: Kind,
  refreshKey: string,
  keyOf: (item: T) => number | string,
  nameOf: (item: T) => string,
) {
  const t = useTranslations("investments");
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: [refreshKey] });
  return useMutation({
    mutationFn: (item: T) => deletePlanItem(kind, keyOf(item)),
    onSuccess: (_, item) => {
      void refresh();
      toast.success(t("deletedName", { name: nameOf(item) }), {
        action: {
          label: t("undo"),
          onClick: () => {
            // Saved again as a new row, so the old id is dropped.
            const rest: Record<string, unknown> = { ...item };
            delete rest.id;
            void savePlanItem(kind, rest).then(refresh);
          },
        },
      });
    },
    onError: () => toast.error(t("deleteFailed")),
  });
}
