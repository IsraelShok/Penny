"use client";

import { useSyncExternalStore } from "react";
import { readStored } from "./legacy-names";

// Tiny custom store. Persists the active workspace id to localStorage and
// exposes a non-React getter so non-component code (e.g. fetchJSON) can
// inject the X-Workspace-ID header.

const STORAGE_KEY = "penny.activeWorkspaceId";
const LEGACY_STORAGE_KEY = "spent.activeWorkspaceId"; // legacy: spent.activeWorkspaceId from installs before the Penny rename

let memValue: number | null = readFromStorage();
const listeners = new Set<() => void>();

function readFromStorage(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = readStored(STORAGE_KEY, LEGACY_STORAGE_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function writeToStorage(value: number | null): void {
  if (typeof window === "undefined") return;
  try {
    if (value == null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // Storage may be unavailable (private mode, quota). Memory still works.
  }
}

export function getActiveWorkspaceIdSync(): number | null {
  return memValue;
}

export function setActiveWorkspaceId(value: number | null): void {
  if (memValue === value) return;
  memValue = value;
  writeToStorage(value);
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useActiveWorkspaceId(): number | null {
  return useSyncExternalStore(
    subscribe,
    () => memValue,
    () => null
  );
}

// The active profile (who is using the app). Profiles share the household's data; switching one
// changes only name, look and preferences, sent as X-Profile-ID.
const PROFILE_KEY = "penny.activeProfileId";
let profileValue: number | null = (() => {
  if (typeof window === "undefined") return null;
  try {
    const n = Number(window.localStorage.getItem(PROFILE_KEY));
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
})();

export function getActiveProfileIdSync(): number | null {
  return profileValue;
}

/** Selects a profile and the household it belongs to. */
export function setActiveProfile(profile: { id: number; workspaceId: number }): void {
  if (profileValue !== profile.id) {
    profileValue = profile.id;
    try { window.localStorage.setItem(PROFILE_KEY, String(profile.id)); } catch { /* memory still works */ }
    for (const fn of listeners) fn();
  }
  setActiveWorkspaceId(profile.workspaceId);
}

export function useActiveProfileId(): number | null {
  return useSyncExternalStore(subscribe, () => profileValue, () => null);
}
