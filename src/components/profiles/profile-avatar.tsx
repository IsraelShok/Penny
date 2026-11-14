"use client";

import { cn } from "@/lib/utils";
import { AVATAR_ART, AVATAR_COLORS, avatarArtId } from "@/lib/profile-avatar";
import type { Profile } from "@/lib/types";
import { PetFace } from "@/components/home/pet-card";
import { AvatarArt } from "./avatar-art";

type AvatarLike = Pick<Profile, "id" | "name" | "avatarEmoji" | "avatarColor"> & { avatarPet?: Profile["avatarPet"] };

/** Rounded-square avatar: the profile's own Pip; before one is picked, illustrated art, else a legacy emoji on a colour. */
export function ProfileAvatar({ profile, className, px = 28 }: { profile: AvatarLike; className?: string; px?: number }) {
  const box = cn("flex shrink-0 items-center justify-center overflow-hidden rounded-[28%] font-semibold text-white", className);
  if (profile.avatarPet) return <span aria-hidden className={box}><PetFace mood="happy" pet={profile.avatarPet} px={px} /></span>;
  // No avatar picked yet: a stable illustrated one instead of a bare initial.
  const art = avatarArtId(profile.avatarEmoji) ?? (profile.avatarEmoji ? null : AVATAR_ART[Math.abs(profile.id - 1) % AVATAR_ART.length]);
  if (art) return <span aria-hidden className={box}><AvatarArt id={art} className="size-full" /></span>;
  const color = profile.avatarColor ?? AVATAR_COLORS[Math.abs(profile.id - 1) % AVATAR_COLORS.length];
  return (
    <span aria-hidden className={box} style={{ backgroundColor: color }}>
      {profile.avatarEmoji}
    </span>
  );
}
