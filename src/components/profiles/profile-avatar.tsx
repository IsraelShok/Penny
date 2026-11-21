"use client";

import { cn } from "@/lib/utils";
import { defaultPip } from "@/lib/profile-avatar";
import type { Profile } from "@/lib/types";
import { PetFace } from "@/components/home/pet-card";

type AvatarLike = Pick<Profile, "id" | "name" | "avatarEmoji" | "avatarColor"> & { avatarPet?: Profile["avatarPet"] };

/** Rounded-square avatar: always a Pip, the profile's own or a stable default one, so no other picture style appears. */
export function ProfileAvatar({ profile, className, px = 28 }: { profile: AvatarLike; className?: string; px?: number }) {
  const box = cn("flex shrink-0 items-center justify-center overflow-hidden rounded-[28%] font-semibold text-white", className);
  return <span aria-hidden className={box}><PetFace mood="happy" pet={profile.avatarPet ?? defaultPip(profile.id)} px={px} /></span>;
}
