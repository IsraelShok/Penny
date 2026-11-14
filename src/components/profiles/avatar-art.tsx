import type { ReactNode } from "react";
import type { AvatarArtId } from "@/lib/profile-avatar";

// Original Penny avatars: flat geometric characters on bold backgrounds, 100x100 viewBox.
const INK = "#1f1b2e";
const eyes = (y = 46, dx = 12, cx = 50) => (
  <>
    <circle cx={cx - dx} cy={y} r="4.5" fill={INK} />
    <circle cx={cx + dx} cy={y} r="4.5" fill={INK} />
  </>
);
const smile = (y = 58, w = 10) => (
  <path d={`M${50 - w} ${y}q${w} ${w * 0.9} ${w * 2} 0`} stroke={INK} strokeWidth="4" strokeLinecap="round" fill="none" />
);
const cheeks = (y = 56, dx = 22, c = "#ff8fa3") => (
  <>
    <circle cx={50 - dx} cy={y} r="5" fill={c} opacity=".6" />
    <circle cx={50 + dx} cy={y} r="5" fill={c} opacity=".6" />
  </>
);

const ART: Record<AvatarArtId, { bg: string; body: ReactNode }> = {
  fox: {
    bg: "#2f6fde",
    body: (
      <>
        <path d="M22 30 32 8l14 20zM78 30 68 8 54 28z" fill="#f07a2b" />
        <path d="M18 44c0-18 14-26 32-26s32 8 32 26c0 22-16 38-32 38S18 66 18 44z" fill="#f07a2b" />
        <path d="M30 56c6 0 12 4 20 18 8-14 14-18 20-18-2 16-10 26-20 26s-18-10-20-26z" fill="#fff4e6" />
        {eyes(46, 13)}
        <circle cx="50" cy="62" r="4" fill={INK} />
      </>
    ),
  },
  bear: {
    bg: "#f2b632",
    body: (
      <>
        <circle cx="26" cy="28" r="11" fill="#8a5a3b" />
        <circle cx="74" cy="28" r="11" fill="#8a5a3b" />
        <circle cx="50" cy="54" r="32" fill="#8a5a3b" />
        <ellipse cx="50" cy="64" rx="14" ry="11" fill="#d9a77c" />
        {eyes(48, 13)}
        <ellipse cx="50" cy="59" rx="5" ry="3.5" fill={INK} />
      </>
    ),
  },
  cat: {
    bg: "#e0679b",
    body: (
      <>
        <path d="M20 46 24 14l22 18zM80 46 76 14 54 32z" fill="#3b3550" />
        <circle cx="50" cy="54" r="31" fill="#3b3550" />
        <circle cx="38" cy="50" r="7" fill="#c8f56a" />
        <circle cx="62" cy="50" r="7" fill="#c8f56a" />
        <rect x="36.5" y="45" width="3" height="10" rx="1.5" fill={INK} />
        <rect x="60.5" y="45" width="3" height="10" rx="1.5" fill={INK} />
        <path d="M46 62h8l-4 4z" fill="#ff9fbf" />
      </>
    ),
  },
  owl: {
    bg: "#4caf7a",
    body: (
      <>
        <path d="M20 30 30 18h40l10 12v34c0 14-14 22-30 22S20 78 20 64z" fill="#6b4b8a" />
        <circle cx="37" cy="44" r="12" fill="#fff" />
        <circle cx="63" cy="44" r="12" fill="#fff" />
        {eyes(44, 13)}
        <path d="M45 56h10l-5 8z" fill="#f2b632" />
        <path d="M34 70q16 8 32 0" stroke="#a88bc7" strokeWidth="4" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  frog: {
    bg: "#7c5cff",
    body: (
      <>
        <circle cx="32" cy="32" r="13" fill="#5ccf6a" />
        <circle cx="68" cy="32" r="13" fill="#5ccf6a" />
        <ellipse cx="50" cy="60" rx="34" ry="26" fill="#5ccf6a" />
        <circle cx="32" cy="32" r="7" fill="#fff" />
        <circle cx="68" cy="32" r="7" fill="#fff" />
        {eyes(33, 18)}
        <path d="M30 62q20 14 40 0" stroke={INK} strokeWidth="4" fill="none" strokeLinecap="round" />
        {cheeks(64, 26)}
      </>
    ),
  },
  panda: {
    bg: "#2fa7c9",
    body: (
      <>
        <circle cx="26" cy="28" r="11" fill={INK} />
        <circle cx="74" cy="28" r="11" fill={INK} />
        <circle cx="50" cy="54" r="32" fill="#fff" />
        <ellipse cx="37" cy="50" rx="8" ry="10" fill={INK} transform="rotate(-20 37 50)" />
        <ellipse cx="63" cy="50" rx="8" ry="10" fill={INK} transform="rotate(20 63 50)" />
        <circle cx="38" cy="49" r="2.5" fill="#fff" />
        <circle cx="62" cy="49" r="2.5" fill="#fff" />
        <ellipse cx="50" cy="63" rx="5" ry="3.5" fill={INK} />
      </>
    ),
  },
  robot: {
    bg: "#f08a4b",
    body: (
      <>
        <rect x="47" y="10" width="6" height="12" fill="#cfd6e3" />
        <circle cx="50" cy="10" r="5" fill="#ffd84d" />
        <rect x="20" y="22" width="60" height="56" rx="16" fill="#cfd6e3" />
        <rect x="28" y="34" width="44" height="22" rx="11" fill="#27304a" />
        <circle cx="40" cy="45" r="5" fill="#6ff0ff" />
        <circle cx="60" cy="45" r="5" fill="#6ff0ff" />
        <rect x="36" y="64" width="28" height="5" rx="2.5" fill="#8a93a8" />
      </>
    ),
  },
  sun: {
    bg: "#3d2fd3",
    body: (
      <>
        <g fill="#ffd84d">
          {Array.from({ length: 8 }, (_, i) => (
            <rect key={i} x="46" y="6" width="8" height="16" rx="4" transform={`rotate(${i * 45} 50 50)`} />
          ))}
        </g>
        <circle cx="50" cy="50" r="27" fill="#ffc533" />
        {eyes(46, 10)}
        {smile(56, 9)}
        {cheeks(56, 17, "#ff7a59")}
      </>
    ),
  },
  ghost: {
    bg: "#1f8f8a",
    body: (
      <>
        <path d="M22 50c0-18 12-32 28-32s28 14 28 32v32l-7-6-7 6-7-6-7 6-7-6-7 6-7-6-7 6z" fill="#fff" />
        <ellipse cx="40" cy="48" rx="5" ry="7" fill={INK} />
        <ellipse cx="60" cy="48" rx="5" ry="7" fill={INK} />
        <ellipse cx="50" cy="62" rx="5" ry="4" fill={INK} />
      </>
    ),
  },
  bunny: {
    bg: "#ff6f61",
    body: (
      <>
        <rect x="30" y="6" width="14" height="38" rx="7" fill="#fff" />
        <rect x="56" y="6" width="14" height="38" rx="7" fill="#fff" />
        <rect x="34" y="12" width="6" height="26" rx="3" fill="#ffb3c4" />
        <rect x="60" y="12" width="6" height="26" rx="3" fill="#ffb3c4" />
        <circle cx="50" cy="60" r="27" fill="#fff" />
        {eyes(56, 11)}
        <path d="M46 64h8l-4 4z" fill="#ff7a9a" />
        {cheeks(66, 18)}
      </>
    ),
  },
  alien: {
    bg: "#151a3a",
    body: (
      <>
        <circle cx="50" cy="12" r="5" fill="#ff5fd2" />
        <rect x="48.5" y="12" width="3" height="12" fill="#7ef0a0" />
        <path d="M18 48c0-16 14-26 32-26s32 10 32 26c0 20-16 34-32 34S18 68 18 48z" fill="#7ef0a0" />
        <ellipse cx="36" cy="50" rx="9" ry="12" fill={INK} transform="rotate(-25 36 50)" />
        <ellipse cx="64" cy="50" rx="9" ry="12" fill={INK} transform="rotate(25 64 50)" />
        <circle cx="38" cy="46" r="3" fill="#fff" />
        <circle cx="62" cy="46" r="3" fill="#fff" />
        {smile(68, 6)}
      </>
    ),
  },
  penguin: {
    bg: "#8fd3ff",
    body: (
      <>
        <ellipse cx="50" cy="56" rx="32" ry="34" fill="#232838" />
        <ellipse cx="50" cy="62" rx="22" ry="26" fill="#fff" />
        {eyes(48, 10)}
        <path d="M43 56h14l-7 8z" fill="#ffa62b" />
        {cheeks(60, 18)}
      </>
    ),
  },
};

/** A full-bleed illustrated avatar; the parent sets size and rounding. */
export function AvatarArt({ id, className }: { id: AvatarArtId; className?: string }) {
  const a = ART[id];
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden focusable="false">
      <rect width="100" height="100" fill={a.bg} />
      {a.body}
    </svg>
  );
}
