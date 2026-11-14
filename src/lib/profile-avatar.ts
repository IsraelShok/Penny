// Shared by the API (validation) and the /profiles UI (pickers).
export const AVATAR_COLORS = [
  "#3d2fd3", "#7c5cff", "#e0679b", "#f08a4b", "#e8b931", "#4caf7a", "#2fa7c9", "#6b7280",
] as const;

export const AVATAR_EMOJIS = [
  "🙂", "😎", "🦊", "🐼", "🐱", "🐶", "🦁", "🐸", "🌻", "🌙", "⭐", "🚀", "🎧", "🏠", "💼", "🎨",
] as const;

/** Illustrated avatars, stored in avatarEmoji as "@<id>" so no schema change is needed. */
export const AVATAR_ART = [
  "fox", "bear", "cat", "owl", "frog", "panda", "robot", "sun", "ghost", "bunny", "alien", "penguin",
] as const;
export type AvatarArtId = (typeof AVATAR_ART)[number];

export function avatarArtId(avatarEmoji: string | null | undefined): AvatarArtId | null {
  const id = avatarEmoji?.startsWith("@") ? avatarEmoji.slice(1) : null;
  return (AVATAR_ART as readonly string[]).includes(id ?? "") ? (id as AvatarArtId) : null;
}

/** The seeded "Default" profile reads better as the viewer's own ("Me"). */
export function profileName(name: string, me: string) {
  return name === "Default" ? me : name;
}

export interface AvatarInput {
  avatarEmoji?: string | null;
  avatarColor?: string | null;
}

/** Picks avatar fields out of a request body. Absent = untouched, null/"" = cleared. */
export function parseAvatar(body: unknown): AvatarInput | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const out: AvatarInput = {};
  if ("avatarEmoji" in b) {
    const v = b.avatarEmoji;
    if (v === null || v === "") out.avatarEmoji = null;
    else if (typeof v === "string" && v.trim() && v.length <= 8) out.avatarEmoji = v.trim();
    else return { error: "avatarEmoji must be at most 8 characters" };
  }
  if ("avatarColor" in b) {
    const v = b.avatarColor;
    if (v === null || v === "") out.avatarColor = null;
    else if (typeof v === "string" && (AVATAR_COLORS as readonly string[]).includes(v.toLowerCase()))
      out.avatarColor = v.toLowerCase();
    else return { error: "avatarColor must be one of the palette colours" };
  }
  return out;
}
