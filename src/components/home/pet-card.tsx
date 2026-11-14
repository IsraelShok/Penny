"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Clock, X } from "lucide-react";
import { getCashAhead, getHome, getResilience } from "@/lib/api";
import { usePlan } from "@/hooks/use-plan";
import { useA11y } from "@/components/a11y/a11y-menu";
import { useGentle } from "@/hooks/use-gentle";
import { shekels } from "@/lib/money";
import { PET_ACTION, PET_COLORS, skinFor, PET_SIZES, PET_SKINS, petKey, petLines, petMood, petSnooze, petSnoozeUntil, petToday, petTodo, type PetLine, type PetMood, type PetSettings, type PetStat } from "@/lib/pet";
import { Segmented } from "@/components/ui/segmented";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const NEXT: Record<PetStat, string> = { health: "/overview", food: "/budget", tidy: "/transactions", energy: "/journey", joy: "/journey" };
const pill = "inline-flex min-h-11 items-center rounded-full px-4 text-footnote font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const iconBtn = "grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring";

/** The pet's state from the finances (shared by Home's hero and the corner pet); null until loaded, or when it is off. */
function usePet() {
  const { plan, loaded } = usePlan();
  const on = loaded && plan.pet.enabled;
  const home = useQuery({ queryKey: ["home"], queryFn: getHome, enabled: on });
  const res = useQuery({ queryKey: ["resilience"], queryFn: getResilience, enabled: on });
  const cash = useQuery({ queryKey: ["cash-ahead"], queryFn: getCashAhead, enabled: on });
  const lines = useMemo(() => {
    if (!home.data || !res.data) return null;
    const m = home.data.thisMonth, f = (k: string) => res.data.factors.find((x) => x.key === k);
    const bank = cash.data?.bank;
    return petLines({
      spent: m?.spent ?? null, budget: m?.budget ?? null, elapsed: (m?.timeElapsedPercent ?? 50) / 100,
      emergencyMonths: res.data.emergencyMonths, targetMonths: plan.emergencyMonths, savingsRate: res.data.savingsRate,
      overdraft: f("debt")?.points === 0 || f("buffer")?.points === 0,
      overdraftAmount: bank != null && bank < 0 ? -bank : null,
      uncategorized: home.data.needsAttention?.uncategorized ?? 0,
    });
  }, [home.data, res.data, cash.data, plan.emergencyMonths]);
  if (!on || !lines) return null;
  const today = petToday();
  const todo = petTodo(lines, plan.pet.snooze, today);
  // Snoozed items don't weigh on its mood either: it shouldn't keep fretting over what you asked it to set aside.
  return { pet: plan.pet, mood: petMood(lines.filter((l) => l.ok || todo.includes(l))), todo, today };
}
type PetState = NonNullable<ReturnType<typeof usePet>>;

/** Pocket Pal in Home's purple card: just the face and a "+n" badge; tapping it opens what needs care. */
export function PetHeroAside() {
  const p = usePet();
  const ref = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<{ shown: boolean; small: boolean }>({ shown: false, small: false });
  useEffect(() => {
    // Simple mode renders the card twice (phone column, desktop layout) and hides one with CSS: only the visible copy gets a live face.
    const sync = () => setView({ shown: !!ref.current?.getClientRects().length, small: innerWidth < 768 });
    sync();
    addEventListener("resize", sync);
    return () => removeEventListener("resize", sync);
  }, [p == null]); // eslint-disable-line react-hooks/exhaustive-deps -- re-measure once the span exists
  if (!p) return null;
  // The aside is about a quarter of the width on phones, so the face shrinks with it.
  const px = Math.round(PET_SIZES[p.pet.size] * (view.small ? 0.55 : 0.8));
  return <span ref={ref} className="grid min-h-px min-w-px place-items-center">
    {view.shown && <>
      <PetButton p={p} px={px} onOpen={() => setOpen(true)} />
      <PetSheet p={p} open={open} onOpenChange={setOpen} />
    </>}
  </span>;
}

/** A small live pet on every other page (its eyes follow the pointer), with the same badge and sheet: in the sidebar footer on desktop, next to the menu button in the page header on phones, so it never covers content. */
export function PetMini({ inSidebar }: { inSidebar?: boolean }) {
  const path = usePathname();
  const p = usePet();
  const [open, setOpen] = useState(false);
  if (!p || path === "/") return null;
  const pet = <><PetButton p={p} px={inSidebar ? 44 : 34} onOpen={() => setOpen(true)} mini={inSidebar ? "lg" : "sm"} /><PetSheet p={p} open={open} onOpenChange={setOpen} /></>;
  return <div className={inSidebar ? "hidden justify-center py-1 md:flex" : "flex md:hidden"}>{pet}</div>;
}

function PetButton({ p, px, onOpen, mini }: { p: PetState; px: number; onOpen: () => void; mini?: "lg" | "sm" }) {
  const t = useTranslations("pet");
  const name = p.pet.name || t("defaultName");
  const n = p.todo.length;
  const label = `${t("artLabel", { name, mood: t(`mood_${p.mood}`) })}${n ? `. ${t("badge", { n })}` : ""}`;
  return (
    <button type="button" onClick={onOpen} aria-haspopup="dialog" aria-label={label}
      className={`relative grid place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${mini === "lg" ? "size-14 bg-card/90 shadow-lg ring-1 ring-border backdrop-blur" : mini ? "size-11" : ""}`}>
      <PetFace mood={p.mood} pet={p.pet} px={px} />
      {n > 0 && (
        <span aria-hidden dir="ltr" className={`absolute -end-1 -top-1 grid place-items-center rounded-full bg-destructive font-semibold text-destructive-foreground tabular-nums shadow ${mini ? "min-w-5 px-1 text-caption" : "min-w-7 px-1.5 py-0.5 text-footnote"}`}>
          +{n}
        </span>
      )}
    </button>
  );
}

/** What needs care, most important first; each item can be snoozed (tomorrow, a week) or hidden until next month, for the whole household. */
function PetSheet({ p, open, onOpenChange }: { p: PetState; open: boolean; onOpenChange: (v: boolean) => void }) {
  const t = useTranslations("pet");
  const locale = useLocale();
  const gentle = useGentle();
  const { plan, update } = usePlan();
  const name = p.pet.name || t("defaultName");
  const reason = (key: string) => (gentle && t.has(`${key}_gentle`) ? `${key}_gentle` : key);
  const vars = (l: PetLine) => (l.vars?.amount != null ? { ...l.vars, amount: shekels(l.vars.amount, locale) } : l.vars ?? {});
  // Hidden at once, before the save lands; quick taps build on each other, not on the not-yet-refreshed plan.
  const [gone, setGone] = useState<string[]>([]);
  const snooze = useRef(plan.pet.snooze);
  useEffect(() => { snooze.current = plan.pet.snooze; }, [plan.pet.snooze]);
  const todo = p.todo.filter((l) => !gone.includes(petKey(l)));
  const hide = (l: PetLine, kind: "day" | "week" | "dismiss") => {
    setGone((g) => [...g, petKey(l)]);
    snooze.current = petSnooze(snooze.current, petKey(l), petSnoozeUntil(kind), p.today);
    void update({ pet: { ...plan.pet, snooze: snooze.current } }).catch(() => {});
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{name}</SheetTitle>
          <SheetDescription>{t(`mood_${p.mood}`)}</SheetDescription>
        </SheetHeader>
        <div className="space-y-5 px-4 pb-6">
          <div className="grid place-items-center"><PetFace mood={p.mood} pet={p.pet} px={PET_SIZES[p.pet.size]} /></div>
          {todo.length ? (
            <ol className="space-y-3" aria-label={t("todoLabel")}>
              {todo.map((l) => (
                <li key={petKey(l)} className="rounded-2xl bg-muted/60 p-3">
                  <div className="flex items-start gap-1">
                    <p className="min-w-0 flex-1 pt-2.5 text-footnote">{t(reason(`reason_${l.reason}`), vars(l))}</p>
                    <DropdownMenu>
                      <DropdownMenuTrigger className={iconBtn} aria-label={t("snoozeMenu")}><Clock className="size-4" aria-hidden /></DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => hide(l, "day")}>{t("snoozeDay")}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => hide(l, "week")}>{t("snoozeWeek")}</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <button type="button" onClick={() => hide(l, "dismiss")} aria-label={t("dismiss")} title={t("dismiss")} className={iconBtn}><X className="size-4" aria-hidden /></button>
                  </div>
                  <Link href={NEXT[l.stat]} onClick={() => onOpenChange(false)} className={`${pill} mt-1 bg-primary text-primary-foreground`}>{t(`next_${l.stat}`)}</Link>
                </li>
              ))}
            </ol>
          ) : <p className="text-footnote">{t("allGood", { name })}</p>}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Name, color, size and skin of the pet, shown inline in Settings; each choice is saved for the whole household. */
export function PetCustomizer() {
  const t = useTranslations("pet");
  const { plan, update, loaded } = usePlan();
  const [draft, setDraft] = useState<PetSettings>(plan.pet);
  const [wasLoaded, setWasLoaded] = useState(loaded);
  if (loaded !== wasLoaded) { setWasLoaded(loaded); if (loaded) setDraft(plan.pet); } // take the stored pet once it loads
  const save = (next: PetSettings) => { setDraft(next); void update({ pet: next }).catch(() => {}); };
  const name = draft.name || t("defaultName");
  const swatch = "size-11 rounded-full ring-offset-2 ring-offset-background focus-visible:outline-2 focus-visible:outline-ring aria-checked:ring-2 aria-checked:ring-foreground";

  return (
        <div className="space-y-6">
          <div role="img" aria-label={t("artLabel", { name, mood: t("mood_happy") })} className="grid place-items-center"><PetFace mood="happy" pet={draft} px={PET_SIZES[draft.size]} /></div>
          <label className="block space-y-2">
            <span className="block font-medium">{t("nameLabel")}</span>
            <input value={draft.name} placeholder={t("defaultName")} maxLength={24}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              onBlur={() => { const v = draft.name.trim(); if (v !== plan.pet.name) save({ ...draft, name: v }); }}
              className="min-h-11 w-full rounded-lg border border-border bg-background px-3" />
          </label>
          <div className="space-y-2">
            <span id="pet-color" className="block font-medium">{t("colorLabel")}</span>
            <div role="radiogroup" aria-labelledby="pet-color" className="flex flex-wrap items-center gap-3">
              <button type="button" role="radio" aria-checked={!draft.color} aria-label={t("colorTheme")} onClick={() => save({ ...draft, color: "" })} className={`${swatch} bg-primary`} />
              {PET_COLORS.map((c, i) => (
                <button key={c} type="button" role="radio" aria-checked={draft.color === c} aria-label={t(`color_${i + 1}`)} onClick={() => save({ ...draft, color: c })} className={swatch} style={{ background: c }} />
              ))}
              <label className="inline-flex min-h-11 items-center gap-2 text-footnote">
                <input type="color" value={draft.color || "#0a84ff"} onChange={(e) => setDraft({ ...draft, color: e.target.value })}
                  onBlur={() => { if (draft.color !== plan.pet.color) save(draft); }} className="size-11 cursor-pointer rounded-full border border-border bg-transparent" />
                {t("colorCustom")}
              </label>
            </div>
          </div>
          <div className="space-y-2">
            <span className="block font-medium">{t("sizeLabel")}</span>
            <Segmented label={t("sizeLabel")} value={draft.size} onChange={(size) => save({ ...draft, size })}
              options={(Object.keys(PET_SIZES) as (keyof typeof PET_SIZES)[]).map((s) => ({ value: s, label: t(`size_${s}`) }))} />
          </div>
          <div className="space-y-2">
            <span className="block font-medium">{t("skinLabel")}</span>
            <Segmented label={t("skinLabel")} value={draft.skin} onChange={(skin) => save({ ...draft, skin })}
              options={["", ...PET_SKINS].map((s) => ({ value: s, label: t(`skin_${s || "none"}`) }))} />
            <p className="text-caption text-muted-foreground">{t("skinHint")}</p>
          </div>
        </div>
  );
}

/** Colour and look of one Pip, controlled (the profile editor uses it for each person's own Pip). */
export function PipPicker({ value, onChange }: { value: Pick<PetSettings, "color" | "skin">; onChange: (v: Pick<PetSettings, "color" | "skin">) => void }) {
  const t = useTranslations("pet");
  const id = useId();
  const swatch = "size-11 rounded-full ring-offset-2 ring-offset-background focus-visible:outline-2 focus-visible:outline-ring aria-checked:ring-2 aria-checked:ring-foreground";
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <span id={id} className="block text-sm font-medium">{t("colorLabel")}</span>
        <div role="radiogroup" aria-labelledby={id} className="flex flex-wrap items-center gap-3">
          <button type="button" role="radio" aria-checked={!value.color} aria-label={t("colorTheme")} onClick={() => onChange({ ...value, color: "" })} className={`${swatch} bg-primary`} />
          {PET_COLORS.map((c, i) => (
            <button key={c} type="button" role="radio" aria-checked={value.color === c} aria-label={t(`color_${i + 1}`)} onClick={() => onChange({ ...value, color: c })} className={swatch} style={{ background: c }} />
          ))}
          <label className="inline-flex min-h-11 items-center gap-2 text-footnote">
            <input type="color" value={value.color || "#0a84ff"} onChange={(e) => onChange({ ...value, color: e.target.value })} className="size-11 cursor-pointer rounded-full border border-border bg-transparent" />
            {t("colorCustom")}
          </label>
        </div>
      </div>
      <div className="space-y-2">
        <span className="block text-sm font-medium">{t("skinLabel")}</span>
        <Segmented label={t("skinLabel")} value={value.skin} onChange={(skin) => onChange({ ...value, skin })}
          options={["", ...PET_SKINS].map((s) => ({ value: s, label: t(`skin_${s || "none"}`) }))} />
      </div>
    </div>
  );
}

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "boop-face": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { size?: string; color?: string; motion?: string; skin?: string };
    }
  }
}

const FALLBACK: Record<PetMood, string> = { happy: "😊", ok: "🙂", hungry: "😋", caring: "🤗" };
type Face = HTMLElement & { play?: (a: string) => unknown; setPointerFollow?: (on: boolean) => unknown };

/**
 * The face is BoopFace (CX ArtLab, MIT): a client-only web component, loaded on demand (the lite build; the full one with its skin painters only once a skin is picked).
 * Until it is ready the box stays empty: no emoji underneath and no flat face before the skin, so a refresh never shows layers. The emoji is only for a failed load.
 */
export function PetFace({ mood, pet, px }: { mood: PetMood; pet: Pick<PetSettings, "color" | "skin">; px: number }) {
  const ref = useRef<Face>(null);
  const still = useA11y().prefs.stopMotion; // the menu's "Stop animations" (BoopFace already honors the OS setting under motion="auto")
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  // The face sets color as an SVG fill, so it needs a resolved color, not a CSS variable (only read on the client: the face never renders on the server).
  const [theme] = useState(() => (typeof document === "undefined" ? undefined : getComputedStyle(document.documentElement).getPropertyValue("--primary").trim() || undefined));
  useEffect(() => {
    let live = true;
    (pet.skin ? import("boopface").then((m) => m.loadSkins()) : import("boopface/lite"))
      .then(() => customElements.whenDefined("boop-face"))
      .then(() => { if (live) setState("ready"); }, () => { if (live) setState("failed"); });
    return () => { live = false; };
  }, [pet.skin]);
  useEffect(() => {
    if (state !== "ready") return;
    ref.current?.setPointerFollow?.(true); // eyes follow the pointer anywhere on the page (BoopFace listens on window)
    void ref.current?.play?.(PET_ACTION[mood]);
  }, [state, mood, pet.skin]);
  const skin = pet.skin ? skinFor(pet.skin, pet.color || theme || "") : undefined;
  return (
    <span aria-hidden className="grid place-items-center" style={{ width: px, height: px }}>
      {state === "ready" ? <boop-face key={skin} ref={ref} size={String(px)} color={pet.color || theme} skin={skin} motion={still ? "reduce" : "auto"} />
        : state === "failed" ? <span style={{ fontSize: px * 0.45 }}>{FALLBACK[mood]}</span> : null}
    </span>
  );
}
