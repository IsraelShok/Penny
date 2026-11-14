"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/** Pages that live together under one main area, shown as tabs so each area is one place in the menu. */
export const SECTIONS = [
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
    { href: "/life", key: "life" },
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
  const current = tabs.find((x) => isActive(x.href)) ?? tabs[0];
  return (
    <nav aria-label={t(tabs[0].key)} className="mx-auto flex w-full max-w-[76rem] justify-center px-4 pb-2 md:justify-start md:px-6 lg:px-8">
      {/* Phone: one button with the current tab that opens the list; the menu handles Esc, outside tap and focus. */}
      <DropdownMenu>
        <DropdownMenuTrigger className="glass inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border/60 px-4 text-footnote font-semibold shadow-sm focus-visible:outline-2 focus-visible:outline-ring md:hidden">
          {t(current.key)}
          <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="min-w-56">
          {tabs.map((x) => {
            const active = isActive(x.href);
            return (
              <DropdownMenuItem key={x.href} render={<Link href={x.href} aria-current={active ? "page" : undefined} />} className={cn("min-h-11 justify-between px-3 text-base", active && "font-semibold")}>
                {t(x.key)}
                {active && <Check className="size-4 text-primary" aria-hidden />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      {/* Frosted panel, aligned with the page's heading edge: page text never shows through it. */}
      <div className="glass inline-flex max-w-full gap-1 rounded-full border border-border/60 p-1 shadow-sm max-md:hidden">
        {tabs.map((x) => {
          const active = isActive(x.href);
          return (
            <Link
              key={x.href}
              href={x.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "min-h-9 content-center whitespace-nowrap rounded-full px-3 text-footnote sm:px-4 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                active ? "bg-primary font-semibold text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent hover:text-foreground",
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
