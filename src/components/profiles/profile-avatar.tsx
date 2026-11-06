import { cn } from "@/lib/utils";
import { AVATAR_COLORS } from "@/lib/profile-avatar";
import type { Workspace } from "@/lib/types";

type AvatarLike = Pick<Workspace, "id" | "name" | "avatarEmoji" | "avatarColor">;

/** Rounded-square avatar: emoji on the chosen colour, or the name's initial. */
export function ProfileAvatar({ profile, className }: { profile: AvatarLike; className?: string }) {
  const color = profile.avatarColor ?? AVATAR_COLORS[Math.abs(profile.id - 1) % AVATAR_COLORS.length];
  const initial = profile.name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      aria-hidden
      className={cn("flex shrink-0 items-center justify-center rounded-[28%] font-semibold text-white", className)}
      style={{ backgroundColor: color }}
    >
      {profile.avatarEmoji ?? initial}
    </span>
  );
}
