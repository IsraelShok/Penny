import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

beforeEach(() => {
  process.env.PENNY_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "penny-passkey-cer-"));
  vi.resetModules();
  globalThis.__pennyDataKey = undefined;
  globalThis.__pennyWebauthnChallenges = undefined;
});

describe("passkey challenges", () => {
  it("a registration challenge cannot unlock, and a wrong-kind try burns it", async () => {
    const pk = await import("@/server/lib/passkeys");
    const { options, getChallenge } = await pk.registrationOptions("localhost");
    expect(pk.takeChallenge(options.challenge, "unlock")).toBe(false);
    expect(pk.takeChallenge(options.challenge, "register")).toBe(false); // single use, even after a miss
    expect(pk.takeChallenge(getChallenge, "register-get")).toBe(true);
    expect(pk.takeChallenge(getChallenge, "register-get")).toBe(false);
  });

  it("expires after five minutes", async () => {
    const pk = await import("@/server/lib/passkeys");
    const { getChallenge } = await pk.registrationOptions("localhost");
    expect(pk.takeChallenge(getChallenge, "register-get", Date.now() + 5 * 60_000 + 1)).toBe(false);
  });

  it("offers no unlock without a passkey for this host", async () => {
    const pk = await import("@/server/lib/passkeys");
    expect(await pk.unlockOptions("localhost")).toBeNull();
  });

  it("rejects a forged registration", async () => {
    const pk = await import("@/server/lib/passkeys");
    const { options, prfSalt } = await pk.registrationOptions("localhost");
    const junk = {
      id: "x",
      rawId: "x",
      type: "public-key" as const,
      clientExtensionResults: {},
      response: { clientDataJSON: "", attestationObject: "" },
    };
    expect(
      await pk.verifyRegistration(
        { rpID: "localhost", origin: "http://localhost:3000" },
        {
          registration: junk,
          assertion: {
            ...junk,
            response: { clientDataJSON: "", authenticatorData: "", signature: "" },
          },
          prfSalt,
          prfOutput: "A".repeat(43),
        },
      ),
    ).toBeNull();
    expect(options.challenge).toBeTruthy();
  });

  it("derives the RP id from the host, IPv6 and ports included", async () => {
    const { relyingParty } = await import("@/server/lib/passkeys");
    const rp = (host: string) =>
      relyingParty(new Request("http://127.0.0.1:3000/api/lock", { headers: { host } }));
    expect(rp("LOCALHOST:3000")).toEqual({ rpID: "localhost", origin: "http://LOCALHOST:3000" });
    expect(rp("[::1]:3000").rpID).toBe("[::1]");
    expect(rp("192.168.1.5").rpID).toBe("192.168.1.5");
  });
});
