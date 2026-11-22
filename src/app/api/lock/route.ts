import { NextResponse } from "next/server";
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import { isLanEnabled, setLanEnabled } from "@/server/lib/lan-access";
import { cookies } from "next/headers";
import {
  IDLE_CHOICES,
  SESSION_COOKIE,
  addPasskey,
  changeLock,
  checkSecret,
  createSession,
  disableLock,
  enableLock,
  endSession,
  idleMinutes,
  isLockEnabled,
  isValidSecret,
  listPasskeys,
  regenerateRecovery,
  removePasskey,
} from "@/server/lib/app-lock";
import { registrationOptions, relyingParty, verifyRegistration } from "@/server/lib/passkeys";
import { withSession } from "./session-cookie";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    enabled: isLockEnabled(),
    idleMinutes: idleMinutes(),
    passkeys: listPasskeys().map(({ id, rpID, createdAt }) => ({ id, rpID, createdAt })),
  });
}

type Body = {
  action?: string;
  current?: unknown;
  secret?: unknown;
  idleMinutes?: unknown;
  id?: unknown;
  registration?: RegistrationResponseJSON;
  assertion?: AuthenticationResponseJSON;
  prfSalt?: unknown;
  prfOutput?: unknown;
};

const NEEDS_CURRENT = ["change", "disable", "recovery", "passkey-options"];

/**
 * enable | change | disable | lock | recovery | passkey-options | passkey-add | passkey-remove.
 * Change, disable, a new recovery code and passkey options need the current passphrase (or recovery code).
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Body;
  const idle = IDLE_CHOICES.find((m) => m === body.idleMinutes) ?? idleMinutes();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;

  if (body.action === "lock") {
    endSession(token);
    return withSession(NextResponse.json({ ok: true }), request, null);
  }
  if (body.action === "enable") {
    if (isLockEnabled()) return NextResponse.json({ error: "already_enabled" }, { status: 409 });
    if (!isValidSecret(body.secret)) return NextResponse.json({ error: "weak" }, { status: 400 });
    const recoveryCode = await enableLock(body.secret, idle);
    // Keep the person who just set it up signed in. The recovery code is shown this once.
    return withSession(NextResponse.json({ ok: true, recoveryCode }), request, createSession());
  }
  if (body.action === "passkey-add" && isLockEnabled()) {
    // Needs the one-time challenge that passkey-options hands out only after a passphrase check.
    const ok =
      body.registration && body.assertion
        ? await verifyRegistration(relyingParty(request), {
            registration: body.registration,
            assertion: body.assertion,
            prfSalt: String(body.prfSalt ?? ""),
            prfOutput: String(body.prfOutput ?? ""),
          })
        : null;
    if (!ok) return NextResponse.json({ error: "passkey_failed" }, { status: 400 });
    addPasskey(ok.stored, ok.prfOutput);
    return NextResponse.json({ ok: true });
  }
  if (body.action === "passkey-remove") {
    removePasskey(String(body.id ?? ""));
    return NextResponse.json({ ok: true });
  }
  if (!NEEDS_CURRENT.includes(body.action ?? ""))
    return NextResponse.json({ error: "bad_action" }, { status: 400 });

  const check = await checkSecret(body.current);
  if (!check.ok)
    return NextResponse.json(
      { error: check.reason, retryAfter: check.retryAfter },
      { status: check.reason === "wait" ? 429 : 401 },
    );
  const current = body.current as string;
  if (body.action === "recovery")
    return NextResponse.json({ ok: true, recoveryCode: regenerateRecovery() });
  if (body.action === "passkey-options")
    return NextResponse.json(await registrationOptions(relyingParty(request).rpID));
  if (body.action === "disable") {
    await disableLock(current);
    // Phone access is allowed only behind the lock: without it, anyone on the network could reach the data.
    if (isLanEnabled()) {
      setLanEnabled(false);
      if (process.env.PENNY_LISTEN_HOST === "0.0.0.0" && process.env.PENNY_RESTARTABLE === "1")
        setTimeout(() => process.exit(75), 300);
    }
    return withSession(NextResponse.json({ ok: true }), request, null);
  }
  const next = typeof body.secret === "string" && body.secret !== "" ? body.secret : null;
  if (next !== null && !isValidSecret(next))
    return NextResponse.json({ error: "weak" }, { status: 400 });
  await changeLock(current, next, idle);
  return NextResponse.json({ ok: true });
}
