"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarDays, Forward, Landmark, Menu, PiggyBank, Settings, SlidersHorizontal, Tags } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { usePlan } from "@/hooks/use-plan";
import { NAV } from "./app-sidebar";

/**
 * Simple mode's only menu: one hamburger at the page's top corner, opening the pages and the few shortcuts.
 * The full side menu belongs to Advanced; here nothing else takes the page's edge.
 */
export function SimpleNavButton({ className }: { className?: string }) {
  const t = useTranslations("nav");
  const tHome = useTranslations("home.simple");
  const pathname = usePathname();
  const { update } = usePlan();
  const [open, setOpen] = useState(false);
  const links: [string, string, typeof Landmark][] = [
    ["/settings/bank", tHome("menuAccounts"), Landmark],
    ["/settings/general", tHome("menuStartDay"), CalendarDays],
    ["/settings/categories", tHome("menuCategories"), Tags],
    ["/investments", tHome("menuSavings"), PiggyBank],
  ];
  const item = "flex min-h-12 items-center gap-3 rounded-xl px-3 text-start hover:bg-accent";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label={tHome("menu")}
        className={className ?? "grid size-11 place-items-center rounded-full text-foreground/80 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"}
      >
        <Menu className="size-5" aria-hidden />
      </SheetTrigger>
      {/* side="left" is the inline start: the same corner as the hamburger, so the panel slides in from the right in Hebrew and the left in English. */}
      <SheetContent side="left" className="w-80 max-w-full">
        <SheetHeader>
          <SheetTitle>{tHome("menu")}</SheetTitle>
        </SheetHeader>
        <nav aria-label={t("mainNavigation")} className="flex flex-col px-2">
          {NAV.map((n) => {
            const active = n.match(pathname);
            return (
              <Link key={n.href} href={n.href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined}
                className={`${item} ${active ? "bg-accent font-medium" : ""}`}>
                <n.Icon className="size-5 shrink-0 text-primary" aria-hidden />
                <span className="flex-1">{t(n.labelKey)}</span>
                {active && <Forward className="text-muted-foreground" aria-hidden />}
              </Link>
            );
          })}
          <div className="my-2 h-px bg-border" role="presentation" />
          {links.map(([href, label, Icon]) => (
            <Link key={href} href={href} onClick={() => setOpen(false)} className={item}>
              <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="flex-1">{label}</span>
            </Link>
          ))}
          <div className="my-2 h-px bg-border" role="presentation" />
          <Link href="/settings" onClick={() => setOpen(false)} className={item}>
            <Settings className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="flex-1">{tHome("menuSettings")}</span>
          </Link>
          <button type="button" onClick={() => { setOpen(false); void update({ razeMode: false }); }}
            className="mt-3 flex min-h-12 items-center gap-3 rounded-xl border border-border px-3 text-start hover:bg-accent">
            <SlidersHorizontal className="size-5 shrink-0 text-primary" aria-hidden />
            <span className="flex-1">{tHome("toAdvanced")}</span>
          </button>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
