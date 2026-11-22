"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { IconButton } from "@/components/ui/icon-button";
import { Loader2, Tags } from "lucide-react";
import { previewCategorize } from "@/lib/api";
import { toast } from "sonner";
import { CategorizeReviewDialog } from "./categorize-review-dialog";
import type { CategorizePreview } from "@/lib/api";

interface CategorizeButtonProps {
  onApplied?: () => void;
}

export function CategorizeButton({ onApplied }: CategorizeButtonProps) {
  const t = useTranslations("dashboard");
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<CategorizePreview | null>(null);

  const mutation = useMutation({
    mutationFn: previewCategorize,
    onSuccess: (data) => {
      if (data.uncategorizedCount === 0) {
        toast.info(t("nothingToCategorize"));
        return;
      }
      setPreview(data);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : t("categorizationFailed"), {
        duration: Infinity,
        closeButton: true,
      });
    },
  });

  return (
    <>
      <IconButton
        label={mutation.isPending ? t("thinking") : t("categorize")}
        variant="ghost"
        size="icon-sm"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
      >
        {mutation.isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Tags className="size-4" aria-hidden />
        )}
      </IconButton>

      {preview && (
        <CategorizeReviewDialog
          preview={preview}
          onClose={() => setPreview(null)}
          onApplied={() => {
            setPreview(null);
            void queryClient.invalidateQueries({ queryKey: ["summary"] });
            void queryClient.invalidateQueries({ queryKey: ["transactions"] });
            void queryClient.invalidateQueries({ queryKey: ["categories"] });
            onApplied?.();
          }}
        />
      )}
    </>
  );
}
