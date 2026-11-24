import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

// icacls is the Windows half of writeOwnerOnly; mocked so its failure path runs on every platform.
const icacls = vi.hoisted(() => ({ fail: false, calls: [] as string[][] }));
vi.mock("child_process", async (orig) => {
  const real = await orig<typeof import("child_process")>();
  return {
    ...real,
    execFileSync: (file: string, args: string[]) => {
      icacls.calls.push([file, ...args]);
      if (icacls.fail) throw new Error("icacls: access denied");
      return Buffer.alloc(0);
    },
  };
});

// legacyKeyPath() is <cwd>/data/.encryption-key: a temp folder stands in for the checkout.
const fakeCwd = fs.mkdtempSync(path.join(os.tmpdir(), "penny-enc-cwd-"));

const realPlatform = process.platform;
const setPlatform = (p: NodeJS.Platform) =>
  Object.defineProperty(process, "platform", { value: p, configurable: true });

let dataDir: string;
let enc: typeof import("@/server/lib/encryption");

beforeEach(async () => {
  // Re-armed every test: restoreAllMocks below would otherwise point cwd back at the real checkout.
  vi.spyOn(process, "cwd").mockReturnValue(fakeCwd);
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "penny-enc-"));
  process.env.PENNY_DATA_DIR = dataDir;
  globalThis.__pennyDataKey = undefined;
  icacls.fail = false;
  icacls.calls.length = 0;
  vi.resetModules();
  enc = await import("@/server/lib/encryption");
});
afterEach(() => {
  setPlatform(realPlatform);
  globalThis.__pennyDataKey = undefined;
  vi.restoreAllMocks();
});

const stat = (mode: number) => ({ mode: 0o100000 | mode }) as fs.Stats;

describe("assertKeyFileMode", () => {
  it("on POSIX, accepts 600 and refuses a key others can read, naming the fix", () => {
    setPlatform("linux");
    expect(() => enc.assertKeyFileMode(stat(0o600), "/k")).not.toThrow();
    expect(() => enc.assertKeyFileMode(stat(0o644), "/k")).toThrow(
      "Refusing to read encryption key: /k has mode 644, expected 600. Fix with: chmod 600 /k",
    );
    expect(() => enc.assertKeyFileMode(stat(0o640), "/k")).toThrow(/mode 640/);
    expect(() => enc.assertKeyFileMode(stat(0o400), "/k")).toThrow(/mode 400/);
    // Padded to three digits.
    expect(() => enc.assertKeyFileMode(stat(0o060), "/k")).toThrow(/mode 060/);
  });

  it("on Windows, mode bits mean nothing and are not checked", () => {
    setPlatform("win32");
    expect(() => enc.assertKeyFileMode(stat(0o777), "C:\\k")).not.toThrow();
  });
});

describe("checkKeyFileAtStartup", () => {
  it("does nothing before a key exists", () => {
    const exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    enc.checkKeyFileAtStartup();
    expect(exit).not.toHaveBeenCalled();
  });

  it("stops the server when the key file is readable by others", () => {
    setPlatform("linux");
    fs.writeFileSync(enc.keyPath(), "ab".repeat(32));
    vi.spyOn(fs, "statSync").mockReturnValue(stat(0o644));
    const exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    enc.checkKeyFileAtStartup();
    expect(exit).toHaveBeenCalledWith(1);
    expect(err.mock.calls[0][0]).toMatch(/expected 600/);
  });

  it("lets a private key file through", () => {
    setPlatform("linux");
    fs.writeFileSync(enc.keyPath(), "ab".repeat(32));
    vi.spyOn(fs, "statSync").mockReturnValue(stat(0o600));
    const exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    enc.checkKeyFileAtStartup();
    expect(exit).not.toHaveBeenCalled();
  });
});

describe("writeOwnerOnly", () => {
  it("on POSIX, writes the file and forces mode 600 even on an existing file", () => {
    setPlatform("linux");
    const file = path.join(dataDir, "secret");
    fs.writeFileSync(file, "old");
    const chmod = vi.spyOn(fs, "chmodSync");
    enc.writeOwnerOnly(file, "new");
    expect(fs.readFileSync(file, "utf8")).toBe("new");
    expect(chmod).toHaveBeenCalledWith(file, 0o600);
    expect(icacls.calls).toEqual([]);
  });

  it("on Windows, strips inherited access and the broad groups with icacls", () => {
    setPlatform("win32");
    const file = path.join(dataDir, "secret");
    enc.writeOwnerOnly(file, "s");
    expect(fs.readFileSync(file, "utf8")).toBe("s");
    expect(icacls.calls).toHaveLength(1);
    const [exe, ...args] = icacls.calls[0];
    expect(exe).toMatch(/icacls\.exe$/);
    expect(args).toEqual([
      file,
      "/inheritance:r",
      "/grant:r",
      `${os.userInfo().username}:F`,
      "/remove:g",
      "*S-1-1-0",
      "*S-1-5-11",
      "*S-1-5-32-545",
    ]);
  });

  it("on Windows, a failing icacls warns and still leaves the secret written", () => {
    setPlatform("win32");
    icacls.fail = true;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const file = path.join(dataDir, "secret");
    expect(() => enc.writeOwnerOnly(file, "s")).not.toThrow();
    expect(fs.readFileSync(file, "utf8")).toBe("s");
    expect(warn).toHaveBeenCalledWith(
      `[security] could not restrict ${file} to the current user:`,
      "icacls: access denied",
    );
  });
});

describe("the data key", () => {
  it("creates a 32-byte key once and reuses it after a restart", async () => {
    const sealed = enc.encrypt("hunter2");
    const hex = fs.readFileSync(enc.keyPath(), "utf8");
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
    globalThis.__pennyDataKey = undefined;
    vi.resetModules();
    const again = await import("@/server/lib/encryption");
    expect(again.decrypt(sealed)).toBe("hunter2");
    expect(fs.readFileSync(again.keyPath(), "utf8")).toBe(hex);
  });

  it("creates the data folder when it is missing", () => {
    const nested = path.join(dataDir, "a", "b");
    process.env.PENNY_DATA_DIR = nested;
    enc.encrypt("x");
    expect(fs.existsSync(path.join(nested, ".encryption-key"))).toBe(true);
  });

  it("adopts the legacy key, refusing one others can read", () => {
    setPlatform("linux");
    const legacy = enc.legacyKeyPath();
    fs.mkdirSync(path.dirname(legacy), { recursive: true });
    fs.writeFileSync(legacy, `${"cd".repeat(32)}\n`);
    const realStat = fs.statSync;
    vi.spyOn(fs, "statSync").mockImplementation(((p: fs.PathLike) =>
      p === legacy ? stat(0o644) : realStat(p)) as typeof fs.statSync);
    expect(() => enc.encrypt("x")).toThrow(/Refusing to read encryption key/);
    expect(fs.existsSync(enc.keyPath())).toBe(false);
    fs.rmSync(legacy);
  });

  it("does not adopt anything when the data folder is ./data itself", () => {
    process.env.PENNY_DATA_DIR = path.join(fakeCwd, "data");
    fs.mkdirSync(process.env.PENNY_DATA_DIR, { recursive: true });
    expect(enc.legacyKeyPath()).toBe(enc.keyPath());
    enc.encrypt("x");
    expect(fs.readFileSync(enc.keyPath(), "utf8")).toMatch(/^[0-9a-f]{64}$/);
    fs.rmSync(enc.keyPath());
  });

  it("rejects a tampered ciphertext instead of returning garbage", () => {
    const sealed = enc.encrypt("bank password");
    const tampered = { ...sealed, encrypted: Buffer.from(sealed.encrypted) };
    tampered.encrypted[0] ^= 1;
    expect(() => enc.decrypt(tampered)).toThrow();
    const wrongTag = { ...sealed, authTag: Buffer.alloc(16) };
    expect(() => enc.decrypt(wrongTag)).toThrow();
    // A fresh IV each time: the same text never encrypts to the same bytes.
    expect(enc.encrypt("bank password").iv.equals(sealed.iv)).toBe(false);
  });

  it("with the app lock on and no unwrapped key, refuses to hand out a key", () => {
    fs.writeFileSync(enc.lockFilePath(), "{}");
    expect(enc.isKeyLocked()).toBe(true);
    expect(() => enc.getKey()).toThrow(enc.AppLockedError);
    expect(() => enc.encrypt("x")).toThrow(enc.APP_LOCKED_MESSAGE);
    // No plaintext key gets created behind the lock's back.
    expect(fs.existsSync(enc.keyPath())).toBe(false);

    // Once unlocked (key in memory) everything works and it no longer reads as locked.
    const key = Buffer.alloc(32, 9);
    enc.setKeyInMemory(key);
    expect(enc.isKeyLocked()).toBe(false);
    expect(enc.getKey()).toBe(key);
    expect(enc.decrypt(enc.encrypt("ok"))).toBe("ok");
  });

  it("AppLockedError carries its name for callers that check it", () => {
    const e = new enc.AppLockedError();
    expect(e.name).toBe("AppLockedError");
    expect(e).toBeInstanceOf(Error);
  });
});
