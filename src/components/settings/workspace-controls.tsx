"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import Link from "next/link";
import { Check, Plus, Trash2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingCard } from "./section-shell";
import {
  deleteWorkspace,
  listWorkspaces,
  renameWorkspace,
} from "@/lib/api";
import {
  setActiveWorkspaceId,
  useActiveWorkspaceId,
} from "@/lib/workspace-store";
import type { Workspace } from "@/lib/types";

function useActiveWorkspace() {
  const activeId = useActiveWorkspaceId();
  const { data: workspaces = [], isError } = useQuery<Workspace[]>({
    queryKey: ["workspaces"],
    queryFn: listWorkspaces,
  });
  const active = workspaces.find((w) => w.id === activeId) ?? workspaces[0];
  return { workspaces, active, isError };
}

export function WorkspaceNameCard() {
  const t = useTranslations("settings.workspace");
  const tCommon = useTranslations("common");
  const { active, isError } = useActiveWorkspace();
  if (isError) return null; // the page shows the shared load-error state
  if (!active) {
    return (
      <SettingCard title={t("nameTitle")}>
        <div className="text-sm text-muted-foreground">{tCommon("loading")}</div>
      </SettingCard>
    );
  }
  return <WorkspaceNameCardInner workspace={active} />;
}

function WorkspaceNameCardInner({ workspace }: { workspace: Workspace }) {
  const t = useTranslations("settings.workspace");
  const tCommon = useTranslations("common");
  const tNav = useTranslations("nav");
  const queryClient = useQueryClient();
  const [name, setName] = useState(workspace.name);

  const rename = useMutation({
    mutationFn: (n: string) => renameWorkspace(workspace.id, n),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      toast.success(t("renamed"));
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : t("renameFailed"));
    },
  });

  const dirty = name.trim() !== workspace.name && name.trim().length > 0;

  return (
    <SettingCard title={t("nameTitle")} description={t("nameDescription")}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px] space-y-1.5">
          <Label htmlFor="workspace-rename">{t("nameLabel")}</Label>
          <Input
            id="workspace-rename"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
          />
        </div>
        <IconButton showLabel
          label={rename.isPending ? tCommon("saving") : tCommon("save")}
          variant="default"
          onClick={() => rename.mutate(name.trim())}
          disabled={!dirty || rename.isPending}
        >
          <Check className="size-4" aria-hidden />
        </IconButton>
      </div>
      {/* The sidebar switcher only shows once there are two, so the first extra workspace starts here. */}
      <Link href="/setup?mode=new-workspace" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
        <Plus className="size-4" aria-hidden />
        {tNav("newWorkspace")}
      </Link>
    </SettingCard>
  );
}

export function WorkspaceDangerCard() {
  const queryClient = useQueryClient();
  const { workspaces, active } = useActiveWorkspace();
  if (!active) return null;
  const onlyOne = workspaces.length <= 1;
  return (
    <DangerCard
      workspace={active}
      disabled={onlyOne}
      onDeleted={(remainingId) => {
        setActiveWorkspaceId(remainingId);
        queryClient.invalidateQueries();
      }}
    />
  );
}

function DangerCard({
  workspace,
  disabled,
  onDeleted,
}: {
  workspace: Workspace;
  disabled: boolean;
  onDeleted: (remainingId: number) => void;
}) {
  const t = useTranslations("settings.workspace");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const del = useMutation({
    mutationFn: () => deleteWorkspace(workspace.id),
    onSuccess: async () => {
      const list = await queryClient.fetchQuery<Workspace[]>({
        queryKey: ["workspaces"],
        queryFn: listWorkspaces,
      });
      const next = list.find((w) => w.id !== workspace.id);
      if (next) onDeleted(next.id);
      setOpen(false);
      toast.success(t("deletedToast", { name: workspace.name }));
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : t("deleteFailed"));
    },
  });

  return (
    <>
      <SettingCard title={t("dangerTitle")} description={t("dangerDescription")}>
        <IconButton
          label={t("deleteButton")}
          variant="destructive"
          onClick={() => setOpen(true)}
          disabled={disabled}
        >
          <Trash2 className="size-4" aria-hidden />
        </IconButton>
        {disabled ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {t("lastOneHint")}
          </p>
        ) : null}
      </SettingCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("confirmTitle", { name: workspace.name })}</DialogTitle>
            <DialogDescription>{t("confirmDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <IconButton
              label={tCommon("cancel")}
              variant="outline"
              onClick={() => setOpen(false)}
            >
              <X className="size-4" aria-hidden />
            </IconButton>
            <IconButton
              label={del.isPending ? tCommon("deleting") : t("deleteButton")}
              variant="destructive"
              onClick={() => del.mutate()}
              disabled={del.isPending}
            >
              <Trash2 className="size-4" aria-hidden />
            </IconButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
