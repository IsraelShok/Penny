// Browser side of passkey unlock: plain navigator.credentials calls, because the PRF extension's
// salts and results are binary and must be converted by hand anyway.

type Json = Record<string, unknown>;

const toB64u = (buf: ArrayBuffer | ArrayBufferView) => {
  const bytes =
    buf instanceof ArrayBuffer
      ? new Uint8Array(buf)
      : new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};
const fromB64u = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

/**
 * "ok", or why passkeys can't be offered here: WebAuthn needs a secure context (localhost counts,
 * plain http on a LAN address does not) and a domain name as RP id (127.0.0.1 is not one).
 */
export async function passkeySupport(): Promise<
  "ok" | "unsupported" | "insecure" | "ip" | "noprf"
> {
  if (!window.isSecureContext) return "insecure";
  if (!window.PublicKeyCredential) return "unsupported";
  if (/^[\d.]+$/.test(location.hostname) || location.hostname.startsWith("[")) return "ip";
  // Browsers that can report it say up front whether PRF exists; others find out at registration.
  const caps = await (
    PublicKeyCredential as unknown as {
      getClientCapabilities?: () => Promise<Record<string, boolean>>;
    }
  )
    .getClientCapabilities?.()
    .catch(() => undefined);
  return caps?.["extension:prf"] === false ? "noprf" : "ok";
}

async function post(url: string, body: Json): Promise<Json> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Json;
  if (!res.ok) throw Object.assign(new Error(String(json.error ?? "failed")), json);
  return json;
}

const prfFirst = (cred: PublicKeyCredential) => {
  const first = (
    cred.getClientExtensionResults() as { prf?: { results?: { first?: BufferSource } } }
  ).prf?.results?.first;
  return first ? toB64u(first as ArrayBuffer) : null;
};

function assertionJson(cred: PublicKeyCredential) {
  const r = cred.response as AuthenticatorAssertionResponse;
  return {
    id: cred.id,
    rawId: toB64u(cred.rawId),
    type: "public-key",
    clientExtensionResults: {},
    response: {
      authenticatorData: toB64u(r.authenticatorData),
      clientDataJSON: toB64u(r.clientDataJSON),
      signature: toB64u(r.signature),
      ...(r.userHandle ? { userHandle: toB64u(r.userHandle) } : {}),
    },
  };
}

async function getWithPrf(challenge: string, salts: Record<string, string>) {
  const cred = (await navigator.credentials.get({
    publicKey: {
      challenge: fromB64u(challenge),
      userVerification: "required",
      allowCredentials: Object.keys(salts).map((id) => ({ type: "public-key", id: fromB64u(id) })),
      extensions: {
        prf: {
          evalByCredential: Object.fromEntries(
            Object.entries(salts).map(([id, salt]) => [id, { first: fromB64u(salt) }]),
          ),
        },
      } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("cancelled");
  const prfOutput = prfFirst(cred);
  // No PRF output: this authenticator or browser can't derive a key, so it can't unlock.
  if (!prfOutput) throw new Error("no_prf");
  return { assertion: assertionJson(cred), prfOutput };
}

/** Registers a passkey after the passphrase check; throws "no_prf" when PRF is missing. */
export async function registerPasskey(current: string): Promise<void> {
  const { options, getChallenge, prfSalt } = (await post("/api/lock", {
    action: "passkey-options",
    current,
  })) as {
    options: Json & {
      challenge: string;
      user: Json & { id: string };
      excludeCredentials?: { id: string }[];
    };
    getChallenge: string;
    prfSalt: string;
  };
  const cred = (await navigator.credentials.create({
    publicKey: {
      ...(options as unknown as PublicKeyCredentialCreationOptions),
      challenge: fromB64u(options.challenge),
      user: {
        ...(options.user as unknown as PublicKeyCredentialUserEntity),
        id: fromB64u(options.user.id),
      },
      excludeCredentials: (options.excludeCredentials ?? []).map((c) => ({
        type: "public-key" as const,
        id: fromB64u(c.id),
      })),
      extensions: { prf: {} } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("cancelled");
  const enabled = (cred.getClientExtensionResults() as { prf?: { enabled?: boolean } }).prf
    ?.enabled;
  if (enabled === false) throw new Error("no_prf");
  const r = cred.response as AuthenticatorAttestationResponse;
  const registration = {
    id: cred.id,
    rawId: toB64u(cred.rawId),
    type: "public-key",
    clientExtensionResults: {},
    response: {
      clientDataJSON: toB64u(r.clientDataJSON),
      attestationObject: toB64u(r.attestationObject),
      transports: r.getTransports?.() ?? [],
    },
  };
  const { assertion, prfOutput } = await getWithPrf(getChallenge, { [cred.id]: prfSalt });
  await post("/api/lock", { action: "passkey-add", registration, assertion, prfSalt, prfOutput });
}

/** Unlock with any passkey registered on this host. */
export async function unlockWithPasskey(): Promise<void> {
  const { options, prfSalts } = (await post("/api/lock/unlock", { passkey: "options" })) as {
    options: { challenge: string };
    prfSalts: Record<string, string>;
  };
  const { assertion, prfOutput } = await getWithPrf(options.challenge, prfSalts);
  await post("/api/lock/unlock", { passkey: assertion, prfOutput });
}
