"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
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
  Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlan } from "@/hooks/use-plan";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

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

/**
 * The settings frame: with the app's side menu there is nothing to add, but Simple and Minimal modes hide it,
 * so the sections get their own menu here, a column on wide screens and a drawer on phones.
 */
export function SettingsFrame({ children }: { children: ReactNode }) {
  const { plan } = usePlan();
  const withMenu = plan.razeMode || plan.simpleMode;
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-1">
      <div className={cn("mx-auto w-full px-4 pb-8 pt-3 md:px-8", withMenu ? "flex max-w-6xl items-start gap-8" : "max-w-[720px]")}>
        {withMenu && <SettingsSidebar />}
        <div className="min-w-0 max-w-[720px] flex-1">
          {withMenu && <SettingsDrawer />}
          {children}
        </div>
      </div>
    </div>
  );
}

/** The whole map of settings, on one side and without sideways scrolling. */
function SettingsSidebar() {
  const t = useTranslations("settings.sidebar");
  return (
    <nav aria-label={t("title")} className="sticky top-20 hidden max-h-[calc(100vh-6rem)] w-56 shrink-0 overflow-y-auto lg:block">
      <SettingsNavList />
    </nav>
  );
}

function SettingsDrawer() {
  const t = useTranslations("settings.sidebar");
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger className="mb-4 flex min-h-11 w-full items-center gap-2 rounded-xl border border-border/60 bg-card px-3 text-start text-footnote font-medium transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring">
          <Settings2 className="size-4 shrink-0 text-primary" aria-hidden />
          <span className="flex-1">{t("open")}</span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground ltr:rotate-180" aria-hidden />
        </SheetTrigger>
        {/* side="left" sits on the inline start: the right in Hebrew, the left in English. */}
        <SheetContent side="left" className="w-80 max-w-[85vw]">
          <SheetHeader>
            <SheetTitle>{t("title")}</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
            <SettingsNavList onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SettingsNavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const tSidebar = useTranslations("settings.sidebar");
  const tRoot = useTranslations();
  const tCommon = useTranslations("common");
  const label = (item: NavItem) => (item.labelKey.includes(".") ? tRoot(item.labelKey) : tSidebar(item.labelKey));

  return (
    <div className="flex flex-col gap-5">
      {/* Leaving settings should never need hunting: the way back is the first thing in the menu. */}
      <Link
        href="/"
        onClick={onNavigate}
        className="flex min-h-10 items-center gap-1.5 rounded-xl bg-primary px-3 text-footnote font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-ring"
      >
        <ChevronRight className="size-4 ltr:rotate-180" aria-hidden />
        {tCommon("back")}
      </Link>
      {SETTINGS_GROUPS.map((group) => (
        <div key={group.titleKey}>
          <p className="mb-1.5 px-2 text-caption font-medium text-muted-foreground">{tSidebar(group.titleKey)}</p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = item.match(pathname);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-9 items-center gap-2.5 rounded-lg px-2 text-footnote font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                      active ? "bg-primary/10 text-primary" : "text-foreground/70 hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <item.Icon className="size-4 shrink-0" aria-hidden />
                    {label(item)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
