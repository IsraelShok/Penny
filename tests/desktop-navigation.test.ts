import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const { isAppUrl, isSafeExternal } = createRequire(import.meta.url)(
  "../desktop/navigation.cjs",
) as {
  isAppUrl: (target: string, appOrigin: string) => boolean;
  isSafeExternal: (target: string) => boolean;
};

const APP = "http://127.0.0.1:41234";

describe("desktop navigation guard", () => {
  it("keeps only the app's own origin inside the window", () => {
    expect(isAppUrl("http://127.0.0.1:41234/transactions?month=2026-11", APP)).toBe(true);
    // The app address as the username of another host.
    expect(isAppUrl("http://127.0.0.1:41234@evil.example/", APP)).toBe(false);
    expect(isAppUrl("http://127.0.0.1:412345/", APP)).toBe(false);
    expect(isAppUrl("http://127.0.0.1:41235/", APP)).toBe(false);
    expect(isAppUrl("file:///c:/x", APP)).toBe(false);
    expect(isAppUrl("javascript:alert(1)", APP)).toBe(false);
    expect(isAppUrl("not a url", APP)).toBe(false);
  });

  it("hands only web and mail links to the OS", () => {
    expect(isSafeExternal("https://example.com/a")).toBe(true);
    expect(isSafeExternal("http://127.0.0.1:41234@evil.example/")).toBe(true);
    expect(isSafeExternal("mailto:someone@example.com")).toBe(true);
    expect(isSafeExternal("file:///c:/x")).toBe(false);
    expect(isSafeExternal("javascript:alert(1)")).toBe(false);
    expect(isSafeExternal("http://127.0.0.1:412345/")).toBe(false);
    expect(isSafeExternal("not a url")).toBe(false);
  });
});
