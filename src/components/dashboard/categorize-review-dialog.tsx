"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Check, CheckCheck, Loader2, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { applyCategorize, getCategories } from "@/lib/api";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import type { CategorizePreview } from "@/lib/api";

interface CategorizeReviewDialogProps {
  preview: CategorizePreview;
  onClose: () => void;
  onApplied: () => void;
}

export function CategorizeReviewDialog({
  preview,
  onClose,
  onApplied,
}: CategorizeReviewDialogProps) {
  const t = useTranslations("categorizeReview");
  const tc = useTranslations("common");
  const { data: existingCategories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => getCategories(),
  });

  // Track per-proposal state: approved (default true), or a fallback name.
  const [approvedMap, setApprovedMap] = useState<Record<string, boolean>>(
    () => Object.fromEntries(preview.proposedCategories.map((p) => [p.name, true]))
  );

  const applyMutation = useMutation({
    mutationFn: () =>
      applyCategorize({
        assignments: preview.assignments.map((a) => ({
          transactionId: a.transactionId,
          categoryName: a.categoryName,
          isNew: a.isNew,
          kind: a.kind,
        })),
        approvedNewCategoryNames: Object.entries(approvedMap)
          .filter(([, ok]) => ok)
          .map(([name]) => name),
      }),
    onSuccess: (data) => {
      toast.success(
        data.createdCategoriesCount > 0
          ? t("appliedWithNew", {
              count: data.appliedCount,
              created: data.createdCategoriesCount,
            })
          : t("applied", { count: data.appliedCount })
      );
      onApplied();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : t("applyFailed"));
    },
  });

  const approvedCount = useMemo(
    () => Object.values(approvedMap).filter(Boolean).length,
    [approvedMap]
  );
  const totalProposals = preview.proposedCategories.length;

  // How many transactions will land in an existing category, in a new (approved)
  // category, or stay uncategorized.
  const stats = useMemo(() => {
    let toExisting = 0;
    let toNew = 0;
    let willStay = 0;
    for (const a of preview.assignments) {
      if (!a.isNew) toExisting++;
      else if (approvedMap[a.categoryName]) toNew++;
      else willStay++;
    }
    return { toExisting, toNew, willStay };
  }, [preview.assignments, approvedMap]);

  const sortedExistingUsage = useMemo(
    () =>
      Object.entries(preview.existingCategoryUsage)
        .map(([name, count]) => ({
          name,
          count,
          color:
            existingCategories.find((c) => c.name === name)?.color ?? "#B1AA9C",
        }))
        .sort((a, b) => b.count - a.count),
    [preview.existingCategoryUsage, existingCategories]
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl gap-0 overflow-hidden p-0">
        <DialogHeader className="px-6 pb-3 pt-6">
          <DialogTitle className="font-serif text-2xl tracking-tight">
            {t("title")}
          </DialogTitle>
          <DialogDescription>
            {t("description", { count: preview.uncategorizedCount })}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[55vh] px-6">
          <div className="space-y-6 pb-4">
            {sortedExistingUsage.length > 0 && (
              <section>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  {t("usingExisting", { count: stats.toExisting })}
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {sortedExistingUsage.map((c) => (
                    <span
                      key={c.name}
                      className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs"
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: c.color }}
                      />
                      <span className="font-medium">{c.name}</span>
                      <span className="text-muted-foreground">{c.count}</span>
                    </span>
                  ))}
                </div>
              </section>
            )}

            {totalProposals > 0 ? (
              <section>
                <div className="mb-3 flex items-baseline justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
                    {t("proposedNew", { count: totalProposals })}
                  </h3>
                  <div className="flex gap-1.5">
                    <IconButton
                      label={t("approveAll")}
                      size="icon-xs"
                      className="text-muted-foreground"
                      onClick={() =>
                        setApprovedMap(
                          Object.fromEntries(
                            preview.proposedCategories.map((p) => [
                              p.name,
                              true,
                            ])
                          )
                        )
                      }
                    >
                      <CheckCheck className="size-3.5" aria-hidden />
                    </IconButton>
                    <IconButton
                      label={t("rejectAll")}
                      size="icon-xs"
                      className="text-muted-foreground"
                      onClick={() =>
                        setApprovedMap(
                          Object.fromEntries(
                            preview.proposedCategories.map((p) => [
                              p.name,
                              false,
                            ])
                          )
                        )
                      }
                    >
                      <X className="size-3.5" aria-hidden />
                    </IconButton>
                  </div>
                </div>
                <div className="space-y-2">
                  {preview.proposedCategories.map((p) => (
                    <ProposalRow
                      key={p.name}
                      proposal={p}
                      approved={approvedMap[p.name] ?? false}
                      onToggle={(v) =>
                        setApprovedMap((prev) => ({ ...prev, [p.name]: v }))
                      }
                    />
                  ))}
                </div>
              </section>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("noProposals")}
              </p>
            )}

            {preview.errors && preview.errors.length > 0 && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {t("batchErrors", { count: preview.errors.length })}
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="border-t bg-muted/30 px-6 py-4">
          <div className="me-auto flex flex-col gap-0.5 text-xs text-muted-foreground">
            <div>
              {t.rich("willCategorize", {
                count: stats.toExisting + stats.toNew,
                b: (chunks) => (
                  <span className="font-medium text-foreground">{chunks}</span>
                ),
              })}
              {stats.willStay > 0 && (
                <>
                  {" "}
                  ·{" "}
                  {t.rich("willStay", {
                    count: stats.willStay,
                    b: (chunks) => (
                      <span className="text-foreground">{chunks}</span>
                    ),
                  })}
                </>
              )}
            </div>
            {totalProposals > 0 && (
              <div>
                {t.rich("willCreate", {
                  approved: approvedCount,
                  count: totalProposals,
                  b: (chunks) => (
                    <span className="font-medium text-foreground">{chunks}</span>
                  ),
                })}
              </div>
            )}
          </div>
          <IconButton label={tc("cancel")} onClick={onClose}>
            <X className="size-4" aria-hidden />
          </IconButton>
          <IconButton
            label={applyMutation.isPending ? t("applying") : t("apply")}
            variant="default"
            onClick={() => applyMutation.mutate()}
            disabled={applyMutation.isPending}
          >
            {applyMutation.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
          </IconButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProposalRow({
  proposal,
  approved,
  onToggle,
}: {
  proposal: { name: string; transactionIds: number[]; samples: string[] };
  approved: boolean;
  onToggle: (v: boolean) => void;
}) {
  const t = useTranslations("categorizeReview");
  return (
    <div
      className={`flex items-start justify-between gap-4 rounded-xl border p-3 transition-colors ${
        approved ? "border-primary/40 bg-primary/5" : "border-border bg-card"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-bold tracking-tight">
            {proposal.name}
          </span>
          <span className="text-xs text-muted-foreground">
            {t("transactionCount", { count: proposal.transactionIds.length })}
          </span>
        </div>
        <div className="mt-1 truncate text-xs text-muted-foreground">
          {proposal.samples.join(" · ")}
        </div>
      </div>
      <Switch
        checked={approved}
        onCheckedChange={onToggle}
        aria-label={t("approveLabel", { name: proposal.name })}
      />
    </div>
  );
}
