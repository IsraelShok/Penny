import { describe, expect, it } from "vitest";
import { parseSyncError, SYNC_ERRORS, type SyncErrorKey } from "@/lib/sync-errors";
import en from "@/i18n/messages/en.json";
import he from "@/i18n/messages/he.json";

describe("SYNC_ERRORS translations", () => {
  const keys = Object.keys(SYNC_ERRORS) as SyncErrorKey[];

  it.each(keys)("%s has a Hebrew and an English string", (key) => {
    const heText = (he.syncErrors as Record<string, string>)[key];
    const enText = (en.syncErrors as Record<string, string>)[key];
    expect(heText).toMatch(/[א-ת]/);
    expect(enText?.trim()).toBeTruthy();
  });

  it.each(keys)("%s is matched back to its own key, with its detail", (key) => {
    expect(parseSyncError(`${SYNC_ERRORS[key]} (HTTP 500: boom)`)).toEqual({
      key,
      detail: "HTTP 500: boom",
    });
  });
});
