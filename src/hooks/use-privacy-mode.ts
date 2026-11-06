"use client";

import { useCallback, useSyncExternalStore } from "react";
import { PRIVACY_COOKIE } from "@/lib/privacy";

const EVENT = "privacy-mode-change";

const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
};
const read = () => document.documentElement.dataset.privacy === "on";

export function usePrivacyMode(): [boolean, () => void] {
  const on = useSyncExternalStore(subscribe, read, () => false);
  const toggle = useCallback(() => {
    const next = !read();
    document.documentElement.dataset.privacy = next ? "on" : "off";
    document.cookie = `${PRIVACY_COOKIE}=${next ? "on" : "off"}; path=/; max-age=31536000; samesite=strict`;
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [on, toggle];
}
