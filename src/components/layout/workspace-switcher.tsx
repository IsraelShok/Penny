"use client";

import { useRouter } from "next/navigation";
import { profileName } from "@/lib/profile-avatar";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { listProfiles } from "@/lib/api";
import { getActiveWorkspaceIdSync, setActiveProfile, useActiveProfileId } from "@/lib/workspace-store";
import type { Profile } from "@/lib/types";
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

export function useSwitchProfile() {
  const queryClient = useQueryClient();
  return (profile: Profile) => {
    const sameHousehold = getActiveWorkspaceIdSync() === profile.workspaceId;
    setActiveProfile(profile);
    // Same household: data stays; only the greeting (settings) and per-profile prefs change.
    if (sameHousehold) queryClient.invalidateQueries({ queryKey: ["settings"] });
    else queryClient.invalidateQueries();
  };
}

/** Profiles list, and a valid active profile (the first one when none or a stale one is stored). */
export function useProfiles() {
  const activeId = useActiveProfileId();
  const switchProfile = useSwitchProfile();
  const query = useQuery<Profile[]>({ queryKey: ["profiles"], queryFn: listProfiles, staleTime: 60_000 });
  const profiles = query.data ?? [];
  const active = profiles.find((p) => p.id === activeId);
  useEffect(() => {
    // Also moves a browser still pointed at a hidden (pre-profiles) workspace back to the household.
    if (profiles.length && (!active || getActiveWorkspaceIdSync() !== active.workspaceId)) switchProfile(active ?? profiles[0]);
  }, [active, profiles, switchProfile]);
  return { ...query, profiles, active: active ?? profiles[0], activeId };
}

export function WorkspaceSwitcher() {
  const router = useRouter();
  const tp = useTranslations("profiles");
  const switchProfile = useSwitchProfile();
  const { profiles: workspaces, active, activeId } = useProfiles();
  // One profile is the common case: nothing to switch to, so keep the sidebar quiet. /profiles can add another.
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
                tooltip={active ? profileName(active.name, tp("me")) : tp("switch")}
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
                {active ? profileName(active.name, tp("me")) : tp("switch")}
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
            {workspaces.map((w) => (
              <DropdownMenuItem
                key={w.id}
                onClick={() => switchProfile(w)}
                className="gap-2"
              >
                <ProfileAvatar profile={w} className="size-5 text-xs" />
                <span className="flex-1 truncate">{profileName(w.name, tp("me"))}</span>
                {w.id === activeId ? (
                  <Check className="size-4 text-primary" />
                ) : null}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/profiles")} className="gap-2">
              <Users className="size-4" />
              {tp("manage")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
