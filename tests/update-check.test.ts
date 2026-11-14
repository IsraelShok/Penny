import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { checkForUpdate, createUpdateNotifier, installKind, isNewer } from "@/server/update/check";

const github = (tag: string, ok = true) =>
  vi.fn(async () => new Response(JSON.stringify({ tag_name: tag }), { status: ok ? 200 : 403 })) as unknown as typeof fetch;

describe("isNewer", () => {
  it("compares numerically and ignores pre-releases", () => {
    expect(isNewer("v0.10.0", "0.9.9")).toBe(true);
    expect(isNewer("v1.0.0", "1.0.0")).toBe(false);
    expect(isNewer("v0.9.0", "0.10.0")).toBe(false);
    expect(isNewer("v2.0.0-beta.1", "1.0.0")).toBe(false);
  });
});

describe("checkForUpdate", () => {
  it("reports a newer release with its page", async () => {
    const info = await checkForUpdate({ repo: "Sergey-Bar/Penny", current: "0.1.0", fetchFn: github("v0.2.0") });
    expect(info).toEqual({ current: "0.1.0", latest: "0.2.0", url: "https://github.com/Sergey-Bar/Penny/releases/tag/v0.2.0" });
  });
  it("returns null when up to date, unknown, or GitHub fails", async () => {
    expect(await checkForUpdate({ repo: "Sergey-Bar/Penny", current: "0.2.0", fetchFn: github("v0.2.0") })).toBeNull();
    expect(await checkForUpdate({ repo: "Sergey-Bar/Penny", current: "dev", fetchFn: github("v9.0.0") })).toBeNull();
    expect(await checkForUpdate({ repo: "Sergey-Bar/Penny", current: "0.1.0", fetchFn: github("v0.2.0", false) })).toBeNull();
  });
  it("rejects a repo that is not a plain GitHub name", async () => {
    const fetchFn = github("v9.0.0");
    expect(await checkForUpdate({ repo: "evil.com/x/y", current: "0.1.0", fetchFn })).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe("createUpdateNotifier", () => {
  it("sends one message per new version, never the same one twice", async () => {
    const send = vi.fn<(text: string) => Promise<void>>(async () => {});
    const notify = createUpdateNotifier(send, "run it");
    const info = { current: "0.1.0", latest: "0.2.0", url: "u" };
    await notify(info);
    await notify(info);
    await notify({ ...info, latest: "0.3.0" });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0][0]).toContain("run it");
  });
});

describe("installKind", () => {
  it("only trusts known values", () => {
    expect(installKind("desktop")).toBe("desktop");
    expect(installKind("docker")).toBe("docker");
    expect(installKind("x")).toBe("source");
  });
});
