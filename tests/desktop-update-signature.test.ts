import { it, expect } from "vitest";
import crypto from "node:crypto";
import { createRequire } from "node:module";

const { signatureValid } = createRequire(import.meta.url)("../desktop/update.cjs") as {
  signatureValid: (listing: string, sig: string, publicKey?: crypto.KeyObject) => boolean;
};

it("installs only a checksum list signed by the release key", () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const listing = "ab".repeat(32) + "  Penny-Setup-9.9.9.exe\n";
  const sig = crypto.sign(null, Buffer.from(listing), privateKey).toString("base64");
  expect(signatureValid(listing, sig, publicKey)).toBe(true);
  expect(signatureValid(listing.replace("ab", "cd"), sig, publicKey)).toBe(false); // list swapped
  expect(signatureValid(listing, sig)).toBe(false); // signed by someone else's key
  expect(signatureValid(listing, "", publicKey)).toBe(false);
  expect(signatureValid(listing, "not base64 at all", publicKey)).toBe(false);
});
