import "server-only";

import { NextResponse } from "next/server";
import { checkSecret, isLockEnabled } from "@/server/lib/app-lock";

/**
 * For actions that hand out or replace everything (backup, restore, wipe): with the app lock on, a
 * session cookie is not enough and the current passphrase is asked again. Returns the refusal, or
 * null to go ahead. With the lock off there is nothing to check against.
 */
export async function lockReauth(secret: unknown): Promise<NextResponse | null> {
  if (!isLockEnabled()) return null;
  const check = await checkSecret(secret);
  if (check.ok) return null;
  return NextResponse.json(
    { error: check.reason, retryAfter: check.retryAfter },
    { status: check.reason === "wait" ? 429 : 401 },
  );
}
