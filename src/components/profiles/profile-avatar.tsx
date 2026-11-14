import { cn } from "@/lib/utils";
import { AVATAR_ART, AVATAR_COLORS, avatarArtId } from "@/lib/profile-avatar";
import type { Profile } from "@/lib/types";
import { AvatarArt } from "./avatar-art";

type AvatarLike = Pick<Profile, "id" | "name" | "avatarEmoji" | "avatarColor">;

/** Rounded-square avatar: illustrated art, else a legacy emoji on a colour. */
export function ProfileAvatar({ profile, className }: { profile: AvatarLike; className?: string }) {
  // No avatar picked yet: a stable illustrated one instead of a bare initial.
  const art = avatarArtId(profile.avatarEmoji) ?? (profile.avatarEmoji ? null : AVATAR_ART[Math.abs(profile.id - 1) % AVATAR_ART.length]);
  const box = cn("flex shrink-0 items-center justify-center overflow-hidden rounded-[28%] font-semibold text-white", className);
  if (art) return <span aria-hidden className={box}><AvatarArt id={art} className="size-full" /></span>;
  const color = profile.avatarColor ?? AVATAR_COLORS[Math.abs(profile.id - 1) % AVATAR_COLORS.length];
  return (
    <span aria-hidden className={box} style={{ backgroundColor: color }}>
      {profile.avatarEmoji}
    </span>
  );
}
