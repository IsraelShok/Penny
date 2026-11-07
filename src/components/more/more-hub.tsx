"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { CalendarCheck, Car, Compass, FileHeart, FileUp, HandHeart, HeartPulse, LifeBuoy, MessageCircleQuestion, Route, Sparkles } from "lucide-react";

/** Everything that isn't daily, in one calm place: the menu stays short, nothing gets lost. */
const GROUPS = [
  { key: "rituals", items: [
    { href: "/checkin", key: "checkin", Icon: CalendarCheck },
    { href: "/recap", key: "recap", Icon: Sparkles },
    { href: "/wellbeing", key: "wellbeing", Icon: HeartPulse },
  ] },
  { key: "explore", items: [
    { href: "/ask", key: "ask", Icon: MessageCircleQuestion },
    { href: "/journey", key: "journey", Icon: Route },
    { href: "/life", key: "life", Icon: Compass },
    { href: "/car", key: "car", Icon: Car },
  ] },
  { key: "help", items: [
    { href: "/help", key: "help", Icon: LifeBuoy },
    { href: "/welcome", key: "welcome", Icon: HandHeart },
  ] },
  { key: "documents", items: [
    { href: "/settings/legacy", key: "legacy", Icon: FileHeart },
    { href: "/settings/data", key: "import", Icon: FileUp },
  ] },
] as const;

export function MoreHub() {
  const t = useTranslations("moreHub");
  return (
    <div className="space-y-8">
      {GROUPS.map((g) => (
        <section key={g.key} aria-labelledby={`more-${g.key}`}>
          <h2 id={`more-${g.key}`} className="mb-3 px-1 text-footnote font-semibold text-muted-foreground">{t(`group_${g.key}`)}</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {g.items.map(({ href, key, Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="flex h-full items-start gap-4 rounded-2xl bg-card p-5 transition-[background-color] duration-150 hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary" aria-hidden>
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-headline font-semibold">{t(`${key}_title`)}</span>
                    <span className="mt-0.5 block text-footnote text-pretty text-muted-foreground">{t(`${key}_hint`)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
