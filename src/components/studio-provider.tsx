"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { useLocale } from "next-intl";
import { readableAccent, DEFAULT_STUDIO, STUDIO_KEY, parseStudioPreferences, type StudioPreferences } from "@/lib/budget-studio";
import { loadPreference, storePreference } from "@/lib/preference-sync";
import {useActiveWorkspaceId} from "@/lib/workspace-store";
import { studioCopy } from "./dashboard/studio-copy";

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
  const workspaceId=useActiveWorkspaceId();
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STUDIO_KEY);
      const legacy = localStorage.getItem("theme");
      setPreferences(stored ? parseStudioPreferences(stored) : { ...DEFAULT_STUDIO, theme: legacy === "dark" ? "midnight" : legacy === "light" ? "pearl" : "system" });
    } catch { /* Preferences remain usable without storage. */ }
    let active=true;
    void loadPreference("studio").then(value=>{if(active&&value){const prefs=parseStudioPreferences(JSON.stringify(value));setPreferences(prefs);try{localStorage.setItem(STUDIO_KEY,JSON.stringify(prefs));}catch{}}}).catch(()=>{});
    setReady(true);
    const sync = (event: StorageEvent) => {
      if (event.key === STUDIO_KEY || event.key === null) setPreferences(parseStudioPreferences(event.newValue));
    };
    window.addEventListener("storage", sync);
    return () => {active=false;window.removeEventListener("storage", sync);};
  }, [workspaceId]);
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
    try { localStorage.setItem(STUDIO_KEY, JSON.stringify(value)); return true; }
    catch { toast.error(studioCopy(locale).storageError); return false; }
  }, [locale]);
  return <StudioContext.Provider value={{ preferences, preview: setPreferences, save, resolvedStudioTheme }}>{children}</StudioContext.Provider>;
}

export function useStudio() {
  const value = useContext(StudioContext);
  if (!value) throw new Error("useStudio requires StudioProvider");
  return value;
}
