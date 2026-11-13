"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/** Pages that live together under one main area, shown as tabs so each area is one place in the menu. */
const SECTIONS = [
  [
    { href: "/budget", key: "budget" },
    { href: "/overview?tab=period", key: "summary" },
    { href: "/overview?tab=ahead", key: "ahead" },
    { href: "/overview?tab=recurring", key: "recurring" },
  ],
  [
    { href: "/investments", key: "investments" },
    { href: "/fi", key: "fi" },
    { href: "/journey", key: "goals" },
  ],
] as const;

export const sectionOf = (pathname: string) => SECTIONS.find((s) => s.some((x) => pathname.startsWith(x.href.split("?")[0])));

export function SectionTabs() {
  const t = useTranslations("sections");
  const pathname = usePathname();
  const tab = useSearchParams().get("tab") ?? "period";
  // A tab matches by path, and by ?tab= when it names one.
  const isActive = (href: string) => {
    const [path, query] = href.split("?");
    return pathname.startsWith(path) && (!query || query === `tab=${tab}`);
  };
  const tabs = SECTIONS.find((s) => s.some((x) => pathname.startsWith(x.href.split("?")[0])));
  if (!tabs) return null;
  return (
    <nav aria-label={t(tabs[0].key)} className="mx-auto flex w-full max-w-[76rem] justify-center px-4 pb-2 md:px-6 lg:px-8">
      <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-muted/70 p-1">
        {tabs.map((x) => {
          const active = isActive(x.href);
          return (
            <Link
              key={x.href}
              href={x.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "min-h-9 content-center whitespace-nowrap rounded-full px-4 text-footnote font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(x.key)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
