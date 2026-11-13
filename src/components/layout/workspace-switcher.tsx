"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Plus, Settings2, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { listWorkspaces } from "@/lib/api";
import {
  setActiveWorkspaceId,
  useActiveWorkspaceId,
} from "@/lib/workspace-store";
import type { Workspace } from "@/lib/types";
import { useTranslations } from "next-intl";
import { ProfileAvatar } from "@/components/profiles/profile-avatar";

const PROFILE_CHOSEN_KEY = "penny.profileChosen";

/** Remembers for this browser session that the "who's using?" screen was shown. */
export function markProfileChosen() {
  try {
    sessionStorage.setItem(PROFILE_CHOSEN_KEY, "1");
  } catch {}
}

export function profileChosen() {
  try {
    return sessionStorage.getItem(PROFILE_CHOSEN_KEY) === "1";
  } catch {
    return true; // no storage: never nag
  }
}

export function useSwitchWorkspace() {
  const queryClient = useQueryClient();
  return (id: number) => {
    setActiveWorkspaceId(id);
    // Every cache key was scoped to the previous workspace, so wipe it all.
    // Each query refetches against the new X-Workspace-ID.
    queryClient.invalidateQueries();
  };
}

export function WorkspaceSwitcher() {
  const router = useRouter();
  const t = useTranslations("nav");
  const tp = useTranslations("profiles");
  const switchWorkspace = useSwitchWorkspace();
  const activeId = useActiveWorkspaceId();

  const { data: workspaces = [] } = useQuery<Workspace[]>({
    queryKey: ["workspaces"],
    queryFn: listWorkspaces,
    staleTime: 60_000,
  });

  // Bootstrap: if nothing is selected (first load, cleared storage), pick the
  // lowest-id workspace as soon as the list comes back. This avoids a window
  // where requests would fall back to the server-side default and ignore the
  // header entirely.
  useEffect(() => {
    if (activeId == null && workspaces.length > 0) {
      const fallback = workspaces[0];
      setActiveWorkspaceId(fallback.id);
    }
  }, [activeId, workspaces]);

  const active = workspaces.find((w) => w.id === activeId) ?? workspaces[0];
  // One workspace is the common case: nothing to switch to, so keep the sidebar quiet. Settings › General can add another.
  if (workspaces.length < 2) return null;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                tooltip={active?.name ?? t("workspaces")}
              />
            }
          >
            {active ? (
              <ProfileAvatar profile={active} className="size-7 text-base" />
            ) : (
              <div className="size-7 shrink-0 rounded-[28%] bg-primary" />
            )}
            <div className="flex min-w-0 flex-1 flex-col text-start group-data-[collapsible=icon]:sr-only">
              <span className="truncate text-sm font-medium">
                {active?.name ?? t("workspace")}
              </span>
            </div>
            <ChevronsUpDown className="ms-auto size-4 shrink-0 opacity-60 group-data-[collapsible=icon]:hidden" />
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="start"
            side="top"
            sideOffset={8}
            className="min-w-[14rem]"
          >
            <div className="px-2 pb-1 pt-1.5 text-xs font-medium text-muted-foreground">
              {t("workspaces")}
            </div>
            {workspaces.map((w) => (
              <DropdownMenuItem
                key={w.id}
                onClick={() => switchWorkspace(w.id)}
                className="gap-2"
              >
                <ProfileAvatar profile={w} className="size-5 text-xs" />
                <span className="flex-1 truncate">{w.name}</span>
                {w.id === activeId ? (
                  <Check className="size-4 text-primary" />
                ) : null}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/profiles")} className="gap-2">
              <Users className="size-4" />
              {tp("switch")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => router.push("/setup?mode=new-workspace")}
              className="gap-2"
            >
              <Plus className="size-4" />
              {t("newWorkspace")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => router.push("/settings#workspace")}
              className="gap-2"
            >
              <Settings2 className="size-4" />
              {t("manageWorkspaces")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
