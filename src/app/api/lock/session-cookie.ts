import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/server/lib/app-lock";

/** HttpOnly, SameSite=Strict, Secure over https. No Max-Age: the server-side idle expiry is what counts. */
export function withSession(res: NextResponse, request: Request, token: string | null): NextResponse {
  const secure = new URL(request.url).protocol === "https:";
  res.cookies.set(SESSION_COOKIE, token ?? "", { httpOnly: true, sameSite: "strict", secure, path: "/", ...(token ? {} : { maxAge: 0 }) });
  return res;
}
