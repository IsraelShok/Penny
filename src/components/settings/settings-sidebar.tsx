"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  SlidersHorizontal,
  Palette,
  Landmark,
  Send,
  Sparkles,
  Layers,
  ShieldAlert,
  ListFilter,
  Users,
  HeartHandshake,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

const GROUPS: NavGroup[] = [
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
        href: "/settings/data",
        labelKey: "data",
        Icon: ShieldAlert,
        match: (p) => p.startsWith("/settings/data"),
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

export function SettingsSidebar() {
  const pathname = usePathname();
  const tSidebar = useTranslations("settings.sidebar");
  const tRoot = useTranslations();
  const t = (k: string) => (k.includes(".") ? tRoot(k) : tSidebar(k));
  return (
    <aside className="studio-settings-nav hidden w-56 shrink-0 border-e border-border/40 bg-card/30 md:flex md:flex-col">
      <nav className="flex-1 overflow-y-auto px-2 pt-4 pb-6">
        {GROUPS.map((group) => (
          <div key={group.titleKey} className="mt-3">
            <div className="px-3 pb-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {t(group.titleKey)}
            </div>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = item.match(pathname);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-foreground/80 hover:bg-sidebar-accent/60 hover:text-foreground"
                      )}
                    >
                      <item.Icon className="h-4 w-4 shrink-0 opacity-80" />
                      <span className="truncate">{t(item.labelKey)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}

export function SettingsMobileNav() {
  const pathname = usePathname();
  const tSidebar = useTranslations("settings.sidebar");
  const tRoot = useTranslations();
  const t = (k: string) => (k.includes(".") ? tRoot(k) : tSidebar(k));
  const allItems = GROUPS.flatMap((g) => g.items);
  return (
    <div className="-mx-4 overflow-x-auto border-b border-border/40 px-4 md:hidden">
      <div className="flex gap-1 pb-3 pt-1">
        {allItems.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
                      aria-current={active ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors",
                active
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border/60 text-foreground/70 hover:border-border hover:text-foreground"
              )}
            >
              <item.Icon className="h-3.5 w-3.5" />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
