import { describe, expect, it } from "vitest";
import { parseSyncError, SYNC_ERRORS } from "@/lib/sync-errors";

describe("parseSyncError", () => {
  it("splits a stored error into its message key and the scraper detail", () => {
    expect(parseSyncError(`${SYNC_ERRORS.unexpectedHeadless} (Waiting for selector \`#loginPassword\` failed)`)).toEqual({
      key: "unexpectedHeadless",
      detail: "Waiting for selector `#loginPassword` failed",
    });
  });

  it("returns an unknown message as the detail", () => {
    expect(parseSyncError("Scraping failed: boom")).toEqual({ key: null, detail: "Scraping failed: boom" });
  });
});
