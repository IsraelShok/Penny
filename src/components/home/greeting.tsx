"use client";

import { CardAction } from "./card-shell";
import { useLocale, useTranslations } from "next-intl";

const TZ = "Asia/Jerusalem";

function greetingKey(hour: number) {
  if (hour >= 5 && hour < 12) return "greetingMorning";
  if (hour >= 12 && hour < 17) return "greetingAfternoon";
  if (hour >= 17 && hour < 22) return "greetingEvening";
  return "greetingNight";
}

export function Greeting({ name }: { name: string | undefined }) {
  const t = useTranslations("home");
  const locale = useLocale();
  const now = new Date();
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: TZ }).format(now)
  );
  const greeting = t(greetingKey(hour));
  const date = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", timeZone: TZ }).format(now);
  const hebrewDate =
    locale === "he"
      ? new Intl.DateTimeFormat("he-u-ca-hebrew", { day: "numeric", month: "long", timeZone: TZ }).format(now)
      : null;

  return (
    <div className="mb-6 md:mb-8">
      {/* Server and client clocks can straddle a greeting boundary. */}
      <p className="text-footnote text-muted-foreground" suppressHydrationWarning>
        {date}
        {hebrewDate ? ` · ${hebrewDate}` : null}
      </p>
      <h2 className="mt-1 text-[2rem] leading-tight font-medium tracking-tight text-balance" suppressHydrationWarning>
        {name ? t("greetingWithName", { greeting, name }) : greeting}
      </h2>
      {name === "" && (
        <span className="mt-1 inline-block text-primary">
          <CardAction href="/settings/general">{t("addYourName")}</CardAction>
        </span>
      )}
    </div>
  );
}
