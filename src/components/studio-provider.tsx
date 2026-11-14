"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { useLocale } from "next-intl";
import { readableAccent, DEFAULT_STUDIO, STUDIO_KEY, parseStudioPreferences, type StudioPreferences } from "@/lib/budget-studio";
import { loadPreference, storePreference } from "@/lib/preference-sync";
import {useActiveProfileId} from "@/lib/workspace-store";
import { studioCopy } from "./dashboard/studio-copy";

const profileKey = (id: number | null) => `${STUDIO_KEY}.profile${id ?? "default"}`;
function writeLocal(id: number | null, value: StudioPreferences) {
  const raw = JSON.stringify(value);
  localStorage.setItem(profileKey(id), raw);
  localStorage.setItem(STUDIO_KEY, raw);
}

type StudioContextValue = {
  preferences: StudioPreferences;
  preview: (value: StudioPreferences) => void;
  save: (value: StudioPreferences) => boolean;
  resolvedStudioTheme: "pearl" | "midnight" | "glass";
};
const StudioContext = createContext<StudioContextValue | null>(null);

/** One owner for appearance, shared by routes and portalled menus/dialogs. */
export function StudioProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<StudioPreferences>(DEFAULT_STUDIO);
  const [ready, setReady] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const locale = useLocale();
  const profileId=useActiveProfileId(); // per profile: each person keeps their own look
  useEffect(() => {
    try {
      // Each profile keeps its own look; STUDIO_KEY mirrors the active one for the pre-paint script.
      const stored = localStorage.getItem(profileKey(profileId)) ?? localStorage.getItem(STUDIO_KEY);
      const legacy = localStorage.getItem("theme");
      const prefs = stored ? parseStudioPreferences(stored) : { ...DEFAULT_STUDIO, theme: legacy === "dark" ? "midnight" : legacy === "light" ? "pearl" : "system" } as StudioPreferences;
      setPreferences(prefs);
      writeLocal(profileId, prefs);
    } catch { /* Preferences remain usable without storage. */ }
    let active=true;
    void loadPreference("studio").then(value=>{if(active&&value){const prefs=parseStudioPreferences(JSON.stringify(value));setPreferences(prefs);try{writeLocal(profileId,prefs);}catch{}}}).catch(()=>{});
    setReady(true);
    const sync = (event: StorageEvent) => {
      if (event.key === STUDIO_KEY || event.key === null) setPreferences(parseStudioPreferences(event.newValue));
    };
    window.addEventListener("storage", sync);
    return () => {active=false;window.removeEventListener("storage", sync);};
  }, [profileId]);
  useEffect(() => {
    if (ready) setTheme(preferences.theme === "system" ? "system" : preferences.theme === "midnight" ? "dark" : "light");
  }, [preferences.theme, ready, setTheme]);
  const resolvedStudioTheme = preferences.theme === "system" ? resolvedTheme === "dark" ? "midnight" : "pearl" : preferences.theme;
  useEffect(() => {
    if (!ready) return;
    const root = document.documentElement;
    root.classList.add("app-studio");
    root.dataset.studioTheme = resolvedStudioTheme;
    root.dataset.studioAccent = preferences.accent;
    root.dataset.studioDensity = preferences.density;
    root.dataset.studioMotion = String(preferences.motion);
    root.dataset.studioCustom = String(!!preferences.customColor);
    if (preferences.customColor) root.style.setProperty("--custom-primary", readableAccent(preferences.customColor, resolvedStudioTheme === "midnight"));
    else root.style.removeProperty("--custom-primary");
  }, [ready, resolvedStudioTheme, preferences.accent, preferences.density, preferences.motion, preferences.customColor]);
  const save = useCallback((value: StudioPreferences) => {
    setPreferences(value);
    void storePreference("studio",value).catch(()=>toast.error(locale==="he"?"העיצוב נשמר מקומית, אך הסנכרון לשרת נכשל. רעננו לפני ניסיון נוסף.":"Saved locally, but server sync failed. Reload before retrying."));
    try { writeLocal(profileId, value); return true; }
    catch { toast.error(studioCopy(locale).storageError); return false; }
  }, [locale, profileId]);
  return <StudioContext.Provider value={{ preferences, preview: setPreferences, save, resolvedStudioTheme }}>{children}</StudioContext.Provider>;
}

export function useStudio() {
  const value = useContext(StudioContext);
  if (!value) throw new Error("useStudio requires StudioProvider");
  return value;
}
