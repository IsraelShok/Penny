"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  SlidersHorizontal,
  Palette,
  Landmark,
  Send,
  Sparkles,
  Layers,
  ListFilter,
  Users,
  HeartHandshake,
  Lock,
  Accessibility,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlan } from "@/hooks/use-plan";

interface NavItem {
  href: string;
  labelKey: string;
  Icon: React.ComponentType<{ className?: string }>;
  match: (p: string) => boolean;
}

interface NavGroup {
  titleKey: string;
  items: NavItem[];
}

export const SETTINGS_GROUPS: NavGroup[] = [
  {
    titleKey: "groupGeneral",
    items: [
      {
        href: "/settings/general",
        labelKey: "general",
        Icon: SlidersHorizontal,
        match: (p) => p === "/settings/general" || p === "/settings",
      },
      {
        href: "/settings/household",
        labelKey: "household",
        Icon: Users,
        match: (p) => p.startsWith("/settings/household"),
      },
      {
        href: "/settings/appearance",
        labelKey: "appearance",
        Icon: Palette,
        match: (p) => p.startsWith("/settings/appearance"),
      },
      {
        href: "/settings/accessibility",
        labelKey: "a11y.nav",
        Icon: Accessibility,
        match: (p) => p.startsWith("/settings/accessibility"),
      },
    ],
  },
  {
    titleKey: "groupConnections",
    items: [
      {
        href: "/settings/bank",
        labelKey: "bank",
        Icon: Landmark,
        match: (p) => p.startsWith("/settings/bank"),
      },
      {
        href: "/settings/ai",
        labelKey: "ai",
        Icon: Sparkles,
        match: (p) => p.startsWith("/settings/ai"),
      },
      {
        href: "/settings/telegram",
        labelKey: "telegram",
        Icon: Send,
        match: (p) => p.startsWith("/settings/telegram"),
      },
    ],
  },
  {
    titleKey: "groupCategories",
    items: [
      {
        href: "/settings/categories",
        labelKey: "categories",
        Icon: Layers,
        match: (p) => p.startsWith("/settings/categories"),
      },
      {
        href: "/settings/rules",
        labelKey: "rules",
        Icon: ListFilter,
        match: (p) => p.startsWith("/settings/rules"),
      },
    ],
  },
  {
    titleKey: "groupAdvanced",
    items: [
      {
        href: "/settings/privacy",
        labelKey: "privacy",
        Icon: Lock,
        match: (p) => p.startsWith("/settings/privacy"),
      },
      {
        href: "/settings/legacy",
        labelKey: "legacy.nav",
        Icon: HeartHandshake,
        match: (p) => p.startsWith("/settings/legacy"),
      },
    ],
  },
];

const GROUPS = SETTINGS_GROUPS;

export function SettingsMobileNav() {
  const pathname = usePathname();
  const tSidebar = useTranslations("settings.sidebar");
  const tRoot = useTranslations();
  const tCommon = useTranslations("common");
  const t = (k: string) => (k.includes(".") ? tRoot(k) : tSidebar(k));
  const allItems = GROUPS.flatMap((g) => g.items);
  const navRef = useRef<HTMLElement>(null);
  const simple = usePlan().plan.simpleMode;
  // The strip scrolls sideways; keep the current section in view instead of off the edge.
  useEffect(() => {
    navRef.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);
  return (
    // Desktop has these sections in the side menu, except in simple mode (no side menu there).
    <nav ref={navRef} aria-label={tSidebar("title")} className={cn("no-scrollbar -mx-4 mb-4 overflow-x-auto border-b border-border/40 px-4", !simple && "md:hidden")}>
      <div className="flex gap-1.5 pb-3 pt-1">
        {/* Leaving settings should never need hunting: the way back is the first thing on the strip. */}
        <Link
          href="/"
          className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-primary px-3.5 text-footnote font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ChevronRight className="size-4 ltr:rotate-180" aria-hidden />
          {tCommon("back")}
        </Link>
        {allItems.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-footnote font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/60 text-foreground/70 hover:border-border hover:text-foreground"
              )}
            >
              <item.Icon className="size-4" aria-hidden />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
