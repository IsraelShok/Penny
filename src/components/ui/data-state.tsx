"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import { Forward } from "@/components/ui/dir-chevron";import Link from "next/link";
import { useTranslations } from "next-intl";
import { Wallet } from "lucide-react";
export function DataState({ error = false, loading = false, onRetry, period = false }: {
  error?: boolean; loading?: boolean; onRetry?: () => void; period?: boolean;
}) {
  const t = useTranslations("dataState");
  return <section className="rounded-2xl border border-border/60 bg-card px-6 py-10 sm:px-10" aria-busy={loading}>
    <Wallet className="mb-5 size-7 text-muted-foreground" aria-hidden />
    <h2 className="text-xl font-semibold" role={error ? "alert" : "status"}>{t(loading ? "loading" : error ? "error" : period ? "periodTitle" : "title")}</h2>
    {!loading && <p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">{t(error ? "errorHint" : period ? "periodHint" : "hint")}</p>}
    {error && onRetry ? <Button size="lg" onClick={onRetry} className="mt-6">{t("retry")}</Button>
      : !loading && !error && <Link href="/settings/bank" className={buttonVariants({ size: "lg", className: "mt-6" })}>{t("connect")}<Forward /></Link>}
  </section>;
}
