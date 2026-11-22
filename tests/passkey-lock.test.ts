import { describe, it, expect, beforeEach, vi } from "vitest";
import crypto from "node:crypto";
import os from "os";
import path from "path";
import fs from "fs";
import { isoCBOR } from "@simplewebauthn/server/helpers";

let dataDir: string;
const RP = { rpID: "localhost", origin: "http://localhost:3000" };

async function fresh() {
  vi.resetModules();
  globalThis.__pennyDataKey = undefined;
  globalThis.__pennySessions = undefined;
  globalThis.__pennyUnlockFails = undefined;
  globalThis.__pennyWebauthnChallenges = undefined;
  return {
    enc: await import("@/server/lib/encryption"),
    lock: await import("@/server/lib/app-lock"),
    pk: await import("@/server/lib/passkeys"),
  };
}

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "penny-passkey-"));
  process.env.PENNY_DATA_DIR = dataDir;
});

/** A software authenticator: a P-256 key and hand-built authenticator data, as a real device would sign. */
function fakeAuthenticator() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  const jwk = publicKey.export({ format: "jwk" });
  const cose = isoCBOR.encode(
    new Map<number, number | Uint8Array>([
      [1, 2],
      [3, -7],
      [-1, 1],
      [-2, new Uint8Array(Buffer.from(jwk.x!, "base64url"))],
      [-3, new Uint8Array(Buffer.from(jwk.y!, "base64url"))],
    ]),
  );
  const id = crypto.randomBytes(16).toString("base64url");
  const assert = (challenge: string, counter: number, origin = RP.origin, rpID = RP.rpID) => {
    const counterBuf = Buffer.alloc(4);
    counterBuf.writeUInt32BE(counter);
    const authData = Buffer.concat([
      crypto.createHash("sha256").update(rpID).digest(),
      Buffer.from([0x05]), // user present + user verified
      counterBuf,
    ]);
    const clientData = Buffer.from(JSON.stringify({ type: "webauthn.get", challenge, origin }));
    const signature = crypto.sign(
      "sha256",
      Buffer.concat([authData, crypto.createHash("sha256").update(clientData).digest()]),
      privateKey,
    );
    return {
      id,
      rawId: id,
      type: "public-key" as const,
      clientExtensionResults: {},
      response: {
        authenticatorData: authData.toString("base64url"),
        clientDataJSON: clientData.toString("base64url"),
        signature: signature.toString("base64url"),
      },
    };
  };
  return { id, publicKey: Buffer.from(cose).toString("base64url"), assert };
}

async function withPasskey() {
  const env = await fresh();
  env.enc.getKey();
  const code = await env.lock.enableLock("correct horse", 15);
  const auth = fakeAuthenticator();
  const prf = crypto.randomBytes(32);
  env.lock.addPasskey(
    {
      id: auth.id,
      publicKey: auth.publicKey,
      counter: 0,
      rpID: "localhost",
      prfSalt: "s".repeat(43),
    },
    prf,
  );
  return { ...env, auth, prf, code, key: env.enc.getKey() };
}

describe("passkey wraps (PRF)", () => {
  it("wraps the data key under HKDF(PRF output); a wrong output fails", async () => {
    const { lock } = await fresh();
    const key = crypto.randomBytes(32);
    const prf = crypto.randomBytes(32);
    const w = lock.wrapWith(prf, "info", key);
    expect(JSON.stringify(w)).not.toContain(key.toString("hex"));
    expect(lock.unwrapWith(prf, "info", w).equals(key)).toBe(true);
    expect(() => lock.unwrapWith(crypto.randomBytes(32), "info", w)).toThrow();
    expect(() => lock.unwrapWith(prf, "other-info", w)).toThrow();
  });

  it("unlocks after restart with a verified assertion and the right PRF output", async () => {
    const { auth, prf, key, enc: _e } = await withPasskey();
    const { lock, pk, enc } = await fresh(); // restart: key only wrapped
    expect(enc.isKeyLocked()).toBe(true);
    const opts = await pk.unlockOptions("localhost");
    expect(opts!.prfSalts[auth.id]).toBe("s".repeat(43));
    const stored = lock.listPasskeys()[0];
    const counter = await pk.verifyAssertion(RP, auth.assert(opts!.options.challenge, 1), stored);
    expect(counter).toBe(1);
    const token = lock.unlockWithPasskey(auth.id, prf, counter!);
    expect(enc.getKey().equals(key)).toBe(true);
    expect(lock.touchSession(token)).toBe(true);
    expect(lock.listPasskeys()[0].counter).toBe(1);
  });

  it("rejects a wrong PRF output, a replayed challenge, a lower counter, another origin or RP id", async () => {
    const { auth, lock, pk } = await withPasskey();
    const stored = () => lock.listPasskeys()[0];
    expect(() => lock.unlockWithPasskey(auth.id, crypto.randomBytes(32), 1)).toThrow();

    let { options } = (await pk.unlockOptions("localhost"))!;
    const good = auth.assert(options.challenge, 5);
    expect(await pk.verifyAssertion(RP, good, stored())).toBe(5);
    expect(await pk.verifyAssertion(RP, good, stored())).toBeNull(); // challenge is single use

    ({ options } = (await pk.unlockOptions("localhost"))!);
    const low = auth.assert(options.challenge, 3);
    expect(await pk.verifyAssertion(RP, low, { ...stored(), counter: 5 })).toBeNull();

    ({ options } = (await pk.unlockOptions("localhost"))!);
    const evil = auth.assert(options.challenge, 6, "http://evil.localhost:3000");
    expect(await pk.verifyAssertion(RP, evil, stored())).toBeNull();

    ({ options } = (await pk.unlockOptions("localhost"))!);
    const otherRp = auth.assert(options.challenge, 6, RP.origin, "penny.localhost");
    expect(await pk.verifyAssertion(RP, otherRp, stored())).toBeNull();

    expect(await pk.verifyAssertion(RP, auth.assert("made-up", 7), stored())).toBeNull();
    expect(await pk.unlockOptions("penny.localhost")).toBeNull(); // bound to the host it was made on
  });

  it("changing the passphrase keeps passkeys and recovery; removing and disabling drop them", async () => {
    const { lock, auth, prf, code } = await withPasskey();
    await lock.changeLock("correct horse", "battery staple", 15);
    expect(lock.listPasskeys()).toHaveLength(1);
    lock.unlockWithPasskey(auth.id, prf, 1);
    expect((await lock.checkSecret(code)).ok).toBe(true);
    lock.removePasskey(auth.id);
    expect(lock.listPasskeys()).toHaveLength(0);
    await lock.disableLock("battery staple");
    expect(fs.existsSync(path.join(dataDir, ".app-lock.json"))).toBe(false);
  });
});

describe("recovery code", () => {
  it("is shown once, stored only as a wrap, and unlocks like the passphrase", async () => {
    const { code, key } = await withPasskey();
    expect(code).toMatch(/^[0-9A-Z]{5}(-[0-9A-Z]{5}){4}$/);
    const file = fs.readFileSync(path.join(dataDir, ".app-lock.json"), "utf8");
    expect(file).not.toContain(code.replace(/-/g, ""));
    const { lock, enc } = await fresh();
    expect(await lock.checkSecret(code.toLowerCase().replace(/-/g, " "))).toEqual({ ok: true });
    await lock.unlock(code);
    expect(enc.getKey().equals(key)).toBe(true);
  });

  it("regenerating invalidates the old code; wrong codes back off like a wrong passphrase", async () => {
    const { lock, code } = await withPasskey();
    const next = lock.regenerateRecovery();
    expect(next).not.toBe(code);
    const t0 = 2_000_000;
    expect(await lock.checkSecret(code, t0)).toMatchObject({ reason: "wrong", retryAfter: 1 });
    expect(await lock.checkSecret(next, t0 + 500)).toMatchObject({ reason: "wait" });
    expect(await lock.checkSecret(next, t0 + 1_000)).toEqual({ ok: true });
    // The recovery code also stands in for the passphrase when setting a new one.
    await lock.changeLock(next, "a new passphrase", 15);
    expect(await lock.checkSecret("a new passphrase", t0 + 2_000)).toEqual({ ok: true });
  });

  it("passkey failures share the back-off", async () => {
    const { lock } = await fresh();
    const t0 = 3_000_000;
    expect(lock.failed(t0)).toMatchObject({ retryAfter: 1 });
    expect(lock.backoff(t0 + 500)).toMatchObject({ reason: "wait" });
    expect(lock.backoff(t0 + 1_000)).toBeNull();
  });
});
