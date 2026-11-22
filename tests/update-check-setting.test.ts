import { it, expect, vi } from "vitest";

const store = new Map<string, string>();
vi.mock("@/server/db/queries/settings", () => ({
  getGlobalSetting: (k: string) => store.get(k) ?? null,
  setGlobalSetting: (k: string, v: string) => void store.set(k, v),
}));

it("the Privacy switch turns the update check off and on", async () => {
  delete process.env.PENNY_UPDATE_CHECK;
  const u = await import("@/server/update/latest");
  expect(u.updatesEnabled()).toBe(true);
  u.setUpdateCheckSetting(false);
  expect(u.updatesEnabled()).toBe(false);
  expect(await u.latestUpdate()).toBeNull(); // off: no request to GitHub at all
  u.setUpdateCheckSetting(true);
  expect(u.updatesEnabled()).toBe(true);
});
