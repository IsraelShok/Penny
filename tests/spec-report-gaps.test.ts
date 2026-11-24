// Gaps found by an outside mutation run: each test fails if its named fault is planted.
import { it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

beforeEach(() => {
  process.env.PENNY_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "penny-gaps-"));
  vi.resetModules();
  globalThis.__pennyDataKey = undefined;
  globalThis.__pennySessions = undefined;
  globalThis.__pennyUnlockFails = undefined;
});

it("PM-05: DELETE with a valid confirm still needs a same-origin Origin", async () => {
  const { proxy } = await import("@/proxy");
  const del = (headers: Record<string, string>) =>
    proxy(
      new NextRequest("http://127.0.0.1:3000/api/data/transactions", {
        method: "DELETE",
        headers: { host: "127.0.0.1:3000", ...headers },
        body: JSON.stringify({ confirm: "delete-all-transactions" }),
      }),
    );
  expect(del({}).status).toBe(403);
  expect(del({ origin: "http://evil.example" }).status).toBe(403);
  expect(del({ origin: "http://127.0.0.1:3000" }).status).toBe(200);
});

it("PM-23: a key file with any mode but 600 is refused on POSIX", async () => {
  const { assertKeyFileMode } = await import("@/server/lib/encryption");
  const platform = vi.spyOn(process, "platform", "get").mockReturnValue("linux");
  const stat = (mode: number) => ({ mode: 0o100000 | mode }) as fs.Stats;
  for (const mode of [0o644, 0o640, 0o604, 0o666, 0o700])
    expect(() => assertKeyFileMode(stat(mode), "k")).toThrow(/chmod 600/);
  expect(() => assertKeyFileMode(stat(0o600), "k")).not.toThrow();
  platform.mockRestore();
});

it("PM-32/PM-17: a wrong current passphrase gets 401 and counts toward the back-off", async () => {
  const lock = await import("@/server/lib/app-lock");
  await lock.enableLock("correct horse", 15);
  const { POST } = await import("@/app/api/lock/route");
  const call = (current: string) =>
    POST(
      new Request("http://127.0.0.1:3000/api/lock", {
        method: "POST",
        body: JSON.stringify({ action: "disable", current }),
      }),
    );
  // The first back-off is 1s; freeze the clock so a slow machine cannot outlast it between calls.
  vi.useFakeTimers({ toFake: ["Date"] });
  expect((await call("wrong horse")).status).toBe(401);
  // Counted: the right passphrase right after is held back, and the lock stays on.
  expect((await call("correct horse")).status).toBe(429);
  expect(lock.isLockEnabled()).toBe(true);
});

it("open banking sends its token only over https (plain http only to this machine)", async () => {
  const { connectOpenBanking } = await import("@/server/open-banking/client");
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));
  const run = (baseUrl: string) => connectOpenBanking({ baseUrl, token: "t" }, new Date());
  for (const bad of ["http://bank.example", "ftp://bank.example", "https://u:p@bank.example"])
    expect((await run(bad)).errorMessage).toMatch(/https:\/\/|user name/);
  expect(fetchSpy).not.toHaveBeenCalled();
  await run("http://127.0.0.1:9");
  expect(fetchSpy).toHaveBeenCalledTimes(1);
  fetchSpy.mockRestore();
});

it("cloud prompts keep a transfer's kind but not the person's name; local prompts keep it", async () => {
  const { buildCategorizationPrompt, hideTransferNames } = await import("@/server/ai/prompts");
  expect(hideTransferNames("העברה לדנה כהן")).toBe("העברה [name hidden]");
  expect(hideTransferNames("bit - Dana Cohen")).toBe("bit [name hidden]");
  expect(hideTransferNames("שופרסל דיל")).toBe("שופרסל דיל");
  const tx = [{ description: "העברה לדנה כהן", amount: -100, currency: "ILS" }];
  const cats = [{ name: "Gifts" }] as never;
  expect(buildCategorizationPrompt(tx, cats)).not.toContain("דנה");
  expect(buildCategorizationPrompt(tx, cats, false, [], true)).toContain("דנה");
});

it("past corrections reach the prompt redacted like transactions", async () => {
  const { buildCategorizationPrompt } = await import("@/server/ai/prompts");
  const corrections = [
    { description: "הוראת קבע 123456789", wrongCategory: "Other", correctCategory: "Bills" },
    { description: "העברה לדנה כהן", wrongCategory: "Other", correctCategory: "Gifts" },
  ];
  const cloud = buildCategorizationPrompt([], [{ name: "Bills" }] as never, false, corrections);
  expect(cloud).toContain("הוראת קבע [name hidden]");
  expect(cloud).not.toContain("123456789");
  expect(cloud).not.toContain("דנה");
});

it("the ask prompt's merchant list is redacted and has no transfers", async () => {
  const { topMerchantsForAI } = await import("@/server/ai/prompts");
  const top = topMerchantsForAI([
    { description: "שופרסל דיל", amount: -300 },
    { description: "שופרסל דיל", amount: -200 },
    { description: "העברה לדנה כהן", amount: -5000 },
    { description: "bit - Dana Cohen", amount: -900 },
    { description: "חשבון 987654321 חיוב", amount: -100 },
  ]);
  expect(top).toEqual([
    { merchant: "שופרסל דיל", total: 500 },
    { merchant: "חשבון [number] חיוב", total: 100 },
  ]);
});
