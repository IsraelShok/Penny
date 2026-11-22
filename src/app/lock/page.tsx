import { getTranslations } from "next-intl/server";
import { Lock } from "lucide-react";
import { headers } from "next/headers";
import { LockForm } from "@/components/settings/lock-form";
import { listPasskeys } from "@/server/lib/app-lock";

export const dynamic = "force-dynamic";

export default async function LockPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const t = await getTranslations("lock");
  const { next } = await searchParams;
  // Only same-app paths, never "//host" or a full URL.
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  // Passkeys are bound to the host they were made on; offer the button only where one works.
  const host = ((await headers()).get("host") ?? "").split(":")[0].toLowerCase();
  const passkeyHere = listPasskeys().some((k) => k.rpID === host);
  return (
    <main className="flex min-h-svh flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="space-y-4">
          <span
            className="mx-auto grid size-16 place-items-center rounded-[28%] bg-primary/10 text-primary"
            aria-hidden
          >
            <Lock className="size-7" />
          </span>
          <h1 className="text-[1.625rem] leading-8 font-bold tracking-tight">{t("title")}</h1>
        </div>
        <LockForm next={safeNext} hasPasskey={passkeyHere} />
      </div>
    </main>
  );
}
