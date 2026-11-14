"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { MoreHero } from "@/components/ui/page-hero";
import { SuggestionsCard } from "@/components/home/suggestions-card";
import { CalculatorTiles, NavRow, groupedList } from "@/components/more/calculators";
import { BookOpen, Calculator, ChevronLeft, LayoutDashboard, Compass, FileHeart, FileUp, HandHeart, HeartPulse, LifeBuoy, MessageCircleQuestion, Route, Sparkles } from "lucide-react";
import { DailyTip } from "@/components/tips/tips";

/** Everything that isn't daily, in one calm place: the menu stays short, nothing gets lost. */
const GROUPS = [
  { key: "rituals", items: [
    { href: "/recap", key: "recap", Icon: Sparkles },
    { href: "/wellbeing", key: "wellbeing", Icon: HeartPulse },
  ] },
  { key: "explore", items: [
    { href: "/ask", key: "ask", Icon: MessageCircleQuestion },
    { href: "/journey", key: "journey", Icon: Route },
    { href: "/life", key: "life", Icon: Compass },
    { href: "/calculators", key: "calculators", Icon: Calculator },
    { href: "/learn", key: "learn", Icon: BookOpen },
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
      <MoreHero />
      <Link
        href="/control"
        className="flex items-center gap-4 rounded-2xl bg-primary p-5 text-primary-foreground transition-opacity duration-150 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary-foreground/15" aria-hidden><LayoutDashboard className="size-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-caption font-semibold opacity-80">{t("control_badge")}</span>
          <span className="block text-headline font-semibold">{t("control_title")}</span>
          <span className="mt-0.5 block text-footnote text-pretty opacity-85">{t("control_hint")}</span>
        </span>
        <ChevronLeft className="size-5 shrink-0 opacity-80 ltr:rotate-180" aria-hidden />
      </Link>
      <DailyTip />
      <CalculatorTiles />
      <SuggestionsCard limit={50} />
      <div className="grid gap-x-6 gap-y-6 lg:grid-cols-2">
        {GROUPS.map((g) => (
          <section key={g.key} aria-labelledby={`more-${g.key}`}>
            <h2 id={`more-${g.key}`} className="mb-2 px-1 text-footnote font-semibold text-muted-foreground">{t(`group_${g.key}`)}</h2>
            <ul className={groupedList}>
              {g.items.map(({ href, key, Icon }) => (
                <li key={href}><NavRow href={href} Icon={Icon} title={t(`${key}_title`)} hint={t(`${key}_hint`)} /></li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
