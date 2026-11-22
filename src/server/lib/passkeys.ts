import "server-only";

import crypto from "crypto";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransport,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { listPasskeys, type StoredPasskey } from "./app-lock";

/**
 * WebAuthn ceremonies for passkey unlock. The server checks every signature, challenge, origin,
 * RP id and counter; the PRF output the browser reports is then the key that opens this passkey's
 * wrap of the data key (a wrong output fails the AES-GCM tag, so it cannot be forged into a session).
 */

const TTL = 5 * 60_000;

declare global {
  var __pennyWebauthnChallenges: Map<string, { kind: string; expires: number }> | undefined;
}
const challenges = () => (globalThis.__pennyWebauthnChallenges ??= new Map());

function remember(challenge: string, kind: string, now = Date.now()): void {
  for (const [c, v] of challenges()) if (v.expires <= now) challenges().delete(c);
  challenges().set(challenge, { kind, expires: now + TTL });
}

/** Single use: a challenge is gone after its first check, right or wrong. */
export function takeChallenge(challenge: string, kind: string, now = Date.now()): boolean {
  const entry = challenges().get(challenge);
  challenges().delete(challenge);
  return !!entry && entry.kind === kind && entry.expires > now;
}

/** RP id and origin from the request. The proxy already rejected any host not on the allowlist. */
export function relyingParty(request: Request): { rpID: string; origin: string } {
  const url = new URL(request.url);
  const host = request.headers.get("host") ?? url.host;
  const rpID = host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : host.split(":")[0];
  return { rpID: rpID.toLowerCase(), origin: `${url.protocol}//${host}` };
}

const b64u = (b: Buffer) => b.toString("base64url");

/** Creation options plus a second challenge: right after create(), the browser runs get() to read the PRF output. */
export async function registrationOptions(rpID: string) {
  const existing = listPasskeys().filter((k) => k.rpID === rpID);
  const options = await generateRegistrationOptions({
    rpName: "Penny",
    rpID,
    userName: "penny",
    userID: new TextEncoder().encode("penny-app-lock"),
    attestationType: "none",
    excludeCredentials: existing.map((k) => ({ id: k.id })),
    authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
    extensions: { prf: {} } as AuthenticationExtensionsClientInputs,
  });
  const getChallenge = b64u(crypto.randomBytes(32));
  remember(options.challenge, "register");
  remember(getChallenge, "register-get");
  return { options, getChallenge, prfSalt: b64u(crypto.randomBytes(32)) };
}

export interface VerifiedPasskey {
  stored: Omit<StoredPasskey, "salt" | "iv" | "tag" | "wrapped" | "createdAt">;
  prfOutput: Buffer;
}

/** Checks the new credential and the follow-up assertion that produced the PRF output. */
export async function verifyRegistration(
  rp: { rpID: string; origin: string },
  input: {
    registration: RegistrationResponseJSON;
    assertion: AuthenticationResponseJSON;
    prfSalt: string;
    prfOutput: string;
  },
): Promise<VerifiedPasskey | null> {
  const reg = await verifyRegistrationResponse({
    response: input.registration,
    expectedChallenge: (c) => takeChallenge(c, "register"),
    expectedOrigin: rp.origin,
    expectedRPID: rp.rpID,
    requireUserVerification: true,
  }).catch(() => null);
  if (!reg?.verified) return null;
  const cred = reg.registrationInfo.credential;
  const stored = {
    id: cred.id,
    publicKey: b64u(Buffer.from(cred.publicKey)),
    counter: cred.counter,
    transports: cred.transports,
    rpID: rp.rpID,
    prfSalt: input.prfSalt,
  };
  const counter = await verifyAssertion(rp, input.assertion, stored, "register-get");
  const prfOutput = Buffer.from(input.prfOutput ?? "", "base64url");
  if (counter === null || prfOutput.length < 32 || !/^[\w-]{43}$/.test(input.prfSalt)) return null;
  return { stored: { ...stored, counter }, prfOutput };
}

export async function unlockOptions(rpID: string) {
  const keys = listPasskeys().filter((k) => k.rpID === rpID);
  if (!keys.length) return null;
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
    allowCredentials: keys.map((k) => ({
      id: k.id,
      transports: k.transports as AuthenticatorTransport[] | undefined,
    })),
  });
  remember(options.challenge, "unlock");
  // The browser evaluates the PRF on each passkey's own salt (decoded from base64url client-side).
  return { options, prfSalts: Object.fromEntries(keys.map((k) => [k.id, k.prfSalt])) };
}

/** Verifies an assertion against a stored passkey; returns the new counter, or null. */
export async function verifyAssertion(
  rp: { rpID: string; origin: string },
  response: AuthenticationResponseJSON,
  key: Pick<StoredPasskey, "id" | "publicKey" | "counter" | "transports" | "rpID">,
  kind = "unlock",
): Promise<number | null> {
  if (response?.id !== key.id || key.rpID !== rp.rpID) return null;
  try {
    const result = await verifyAuthenticationResponse({
      response,
      expectedChallenge: (c) => takeChallenge(c, kind),
      expectedOrigin: rp.origin,
      expectedRPID: rp.rpID,
      requireUserVerification: true,
      credential: {
        id: key.id,
        publicKey: new Uint8Array(Buffer.from(key.publicKey, "base64url")),
        counter: key.counter,
        transports: key.transports as AuthenticatorTransport[] | undefined,
      },
    });
    return result.verified ? result.authenticationInfo.newCounter : null;
  } catch {
    // Bad signature, replayed counter, wrong origin or challenge: all just "no".
    return null;
  }
}
