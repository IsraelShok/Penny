import { NextResponse } from "next/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import {
  backoff,
  checkSecret,
  failed,
  listPasskeys,
  succeeded,
  unlock,
  unlockWithPasskey,
  type CheckResult,
} from "@/server/lib/app-lock";
import { relyingParty, unlockOptions, verifyAssertion } from "@/server/lib/passkeys";
import { withSession } from "../session-cookie";

export const dynamic = "force-dynamic";

const refuse = (check: Extract<CheckResult, { ok: false }>) =>
  NextResponse.json(
    { error: check.reason, retryAfter: check.retryAfter },
    { status: check.reason === "wait" ? 429 : 401 },
  );

/** `{secret}` (passphrase or recovery code), `{passkey: "options"}`, or `{passkey: <assertion>, prfOutput}`. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    secret?: unknown;
    passkey?: "options" | AuthenticationResponseJSON;
    prfOutput?: unknown;
  };
  let token: string;
  if (body.passkey === "options") {
    const options = await unlockOptions(relyingParty(request).rpID);
    return NextResponse.json(options ?? { error: "no_passkeys" }, { status: options ? 200 : 404 });
  } else if (body.passkey) {
    // Same back-off as a wrong passphrase.
    const wait = backoff();
    if (wait && !wait.ok) return refuse(wait);
    const assertion = body.passkey;
    const key = listPasskeys().find((k) => k.id === assertion.id);
    const counter = key ? await verifyAssertion(relyingParty(request), assertion, key) : null;
    try {
      if (!key || counter === null) throw new Error("wrong");
      const prf = Buffer.from(String(body.prfOutput ?? ""), "base64url");
      token = unlockWithPasskey(key.id, prf, counter);
      succeeded();
    } catch {
      return refuse(failed() as Extract<CheckResult, { ok: false }>);
    }
  } else {
    const check = await checkSecret(body.secret);
    if (!check.ok) return refuse(check);
    token = await unlock(body.secret as string);
  }
  // The bot could not read its token while the key was wrapped.
  const { startBot } = await import("@/server/bot");
  startBot();
  return withSession(NextResponse.json({ ok: true }), request, token);
}
