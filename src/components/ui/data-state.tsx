"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, Wallet } from "lucide-react";
export function DataState({ error = false, loading = false, onRetry, period = false }: {
  error?: boolean; loading?: boolean; onRetry?: () => void; period?: boolean;
}) {
  const t = useTranslations("dataState");
  return <section className="rounded-2xl border border-border/60 bg-card px-6 py-10 sm:px-10" aria-busy={loading}>
    <Wallet className="mb-5 size-7 text-muted-foreground" aria-hidden />
    <h2 className="text-xl font-semibold" role={error ? "alert" : "status"}>{t(loading ? "loading" : error ? "error" : period ? "periodTitle" : "title")}</h2>
    {!loading && <p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">{t(error ? "errorHint" : period ? "periodHint" : "hint")}</p>}
    {error && onRetry ? <button type="button" onClick={onRetry} className="mt-6 min-h-11 rounded-xl bg-primary px-5 font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">{t("retry")}</button>
      : !loading && !error && <Link href="/settings/bank" className="mt-6 inline-flex min-h-11 items-center gap-3 rounded-xl bg-primary px-5 font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">{t("connect")}<ArrowLeft className="size-4 ltr:rotate-180" aria-hidden /></Link>}
  </section>;
}
