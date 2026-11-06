"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { markProfileChosen, useSwitchWorkspace } from "@/components/layout/workspace-switcher";
import { createWorkspace, deleteWorkspace, listWorkspaces, renameWorkspace } from "@/lib/api";
import { AVATAR_COLORS, AVATAR_EMOJIS } from "@/lib/profile-avatar";
import { setActiveWorkspaceId, useActiveWorkspaceId } from "@/lib/workspace-store";
import { cn } from "@/lib/utils";
import type { Workspace } from "@/lib/types";
import { ProfileAvatar } from "./profile-avatar";

const tile =
  "group flex min-h-11 flex-col items-center gap-3 rounded-3xl p-2 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background";
const square =
  "size-24 text-5xl sm:size-32 sm:text-6xl motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:scale-105 motion-safe:group-active:scale-95";

type Draft = { id: number | null; name: string; avatarEmoji: string | null; avatarColor: string };

export function ProfilesPage() {
  const t = useTranslations("profiles");
  const router = useRouter();
  const qc = useQueryClient();
  const switchWorkspace = useSwitchWorkspace();
  const activeId = useActiveWorkspaceId();
  const [managing, setManaging] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: profiles = [] } = useQuery<Workspace[]>({
    queryKey: ["workspaces"],
    queryFn: listWorkspaces,
  });

  const choose = (id: number) => {
    markProfileChosen();
    switchWorkspace(id);
    router.push("/");
  };

  const onError = (e: unknown) => toast.error(e instanceof Error ? e.message : t("error"));

  const save = useMutation({
    mutationFn: (d: Draft) => {
      const avatar = { avatarEmoji: d.avatarEmoji, avatarColor: d.avatarColor };
      return d.id == null ? createWorkspace(d.name, avatar) : renameWorkspace(d.id, d.name, avatar);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspaces"] });
      setDraft(null);
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteWorkspace(id),
    onSuccess: (_r, id) => {
      if (id === activeId) setActiveWorkspaceId(profiles.find((p) => p.id !== id)?.id ?? null);
      qc.invalidateQueries();
      setDraft(null);
    },
    onError,
  });

  const openEditor = (p?: Workspace) => {
    setConfirmDelete(false);
    setDraft(
      p
        ? { id: p.id, name: p.name, avatarEmoji: p.avatarEmoji, avatarColor: p.avatarColor ?? AVATAR_COLORS[0] }
        : {
            id: null,
            name: "",
            avatarEmoji: AVATAR_EMOJIS[profiles.length % AVATAR_EMOJIS.length],
            avatarColor: AVATAR_COLORS[profiles.length % AVATAR_COLORS.length],
          }
    );
  };

  return (
    <main className="flex min-h-dvh w-full flex-col items-center justify-center bg-background px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        {managing ? t("manageTitle") : t("title")}
      </h1>

      <ul className="mt-10 flex max-w-3xl flex-wrap justify-center gap-6 sm:gap-8">
        {profiles.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              className={tile}
              onClick={() => (managing ? openEditor(p) : choose(p.id))}
              aria-label={managing ? t("editProfile", { name: p.name }) : p.name}
            >
              <span className="relative">
                <ProfileAvatar profile={p} className={cn(square, managing && "opacity-60")} />
                {managing ? (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <Pencil className="size-8 text-white drop-shadow" />
                  </span>
                ) : null}
              </span>
              <span className="max-w-32 truncate text-base text-muted-foreground group-hover:text-foreground">
                {p.name}
              </span>
            </button>
          </li>
        ))}
        <li>
          <button type="button" className={tile} onClick={() => openEditor()}>
            <span
              className={cn(
                square,
                "flex items-center justify-center rounded-[28%] border-2 border-dashed border-border text-muted-foreground group-hover:border-primary group-hover:text-primary"
              )}
            >
              <Plus className="size-10" />
            </span>
            <span className="text-base text-muted-foreground group-hover:text-foreground">{t("add")}</span>
          </button>
        </li>
      </ul>

      <Button
        variant={managing ? "default" : "outline"}
        size="lg"
        className="mt-12"
        aria-pressed={managing}
        onClick={() => setManaging((m) => !m)}
      >
        {managing ? t("done") : t("manage")}
      </Button>

      <Dialog open={draft != null} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent>
          {draft ? (
            <form
              className="flex flex-col gap-5"
              onSubmit={(e) => {
                e.preventDefault();
                if (draft.name.trim()) save.mutate(draft);
              }}
            >
              <DialogHeader>
                <DialogTitle>{draft.id == null ? t("add") : t("edit")}</DialogTitle>
              </DialogHeader>

              <div className="flex justify-center">
                <ProfileAvatar
                  profile={{ id: draft.id ?? 1, name: draft.name, avatarEmoji: draft.avatarEmoji, avatarColor: draft.avatarColor }}
                  className="size-20 text-4xl"
                />
              </div>

              <label className="flex flex-col gap-1.5 text-sm font-medium">
                {t("name")}
                <Input
                  autoFocus
                  required
                  maxLength={60}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="h-11"
                />
              </label>

              <fieldset>
                <legend className="mb-2 text-sm font-medium">{t("emoji")}</legend>
                <div className="grid grid-cols-8 gap-1">
                  {AVATAR_EMOJIS.map((em) => (
                    <button
                      key={em}
                      type="button"
                      aria-pressed={draft.avatarEmoji === em}
                      onClick={() => setDraft({ ...draft, avatarEmoji: em })}
                      className={cn(
                        "flex size-11 items-center justify-center rounded-xl text-2xl outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
                        draft.avatarEmoji === em && "bg-accent ring-2 ring-primary"
                      )}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-2 text-sm font-medium">{t("color")}</legend>
                <div className="flex flex-wrap gap-1">
                  {AVATAR_COLORS.map((c, i) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={t("colorN", { n: i + 1 })}
                      aria-pressed={draft.avatarColor === c}
                      onClick={() => setDraft({ ...draft, avatarColor: c })}
                      className="flex size-11 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span
                        className={cn(
                          "size-8 rounded-full",
                          draft.avatarColor === c && "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                        )}
                        style={{ backgroundColor: c }}
                      />
                    </button>
                  ))}
                </div>
              </fieldset>

              {confirmDelete ? (
                <p role="alert" className="text-sm text-muted-foreground">
                  {t("deleteWarning")}
                </p>
              ) : null}

              <DialogFooter className="gap-2 sm:justify-between">
                {/* Never offer deleting the last profile; the server refuses it too. */}
                {draft.id != null && profiles.length > 1 ? (
                  confirmDelete ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="lg"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(draft.id!)}
                    >
                      {t("confirmDelete")}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="lg"
                      className="text-destructive"
                      onClick={() => setConfirmDelete(true)}
                    >
                      {t("delete")}
                    </Button>
                  )
                ) : (
                  <span />
                )}
                <Button type="submit" size="lg" disabled={!draft.name.trim() || save.isPending}>
                  {t("save")}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </main>
  );
}
