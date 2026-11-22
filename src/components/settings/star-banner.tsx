import { Star } from "lucide-react";
import { useTranslations } from "next-intl";

/** A friendly ask to star the project; sits at the end of General settings. */
export function StarBanner() {
  const t = useTranslations("settings.appearance");
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-primary/20 bg-[color-mix(in_oklch,var(--primary)_7%,var(--card))] p-5 sm:flex-row sm:flex-wrap sm:items-center">
      <span
        className="grid size-11 shrink-0 place-items-center rounded-full bg-amber-400/20"
        aria-hidden
      >
        <Star className="size-5 fill-amber-400 text-amber-500" />
      </span>
      <div className="min-w-[min(100%,12rem)] flex-1">
        <h3 className="font-semibold">{t("starTitle")}</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">{t("starBody")}</p>
      </div>
      <a
        href="https://github.com/Sergey-Bar/Penny"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Star className="size-4" aria-hidden />
        {t("starRepo")}
      </a>
    </section>
  );
}
