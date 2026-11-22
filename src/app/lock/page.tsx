import { getTranslations } from "next-intl/server";
import { Lock } from "lucide-react";
import { LockForm } from "@/components/settings/lock-form";

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
        <LockForm next={safeNext} />
      </div>
    </main>
  );
}
