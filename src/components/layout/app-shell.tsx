"use client";

import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { PageWheelNav } from "./page-wheel-nav";
import { AlertNotifier } from "./alert-notifier";
import { BottomBar } from "./bottom-bar";
import { PrivacyHotkey } from "@/components/settings/privacy-mode-switch";
import { useTranslations } from "next-intl";
import { InfoTip } from "@/components/ui/info-tip";
import { usePathname } from "next/navigation";
import { usePlan } from "@/hooks/use-plan";
import { wantsExplanations } from "@/lib/plan";
import { pagePurposeKey } from "@/lib/orientation";
import { MobileDock } from "./mobile-dock";
import { PetMini } from "@/components/home/pet-card";
import { SectionTabs, sectionOf } from "./section-tabs";
import { NAV } from "./app-sidebar";
import { A11yButton } from "@/components/a11y/a11y-menu";

/** Lives in the root layout so the collapsed state survives page changes. */
export function SidebarRoot({ defaultOpen, children }: { defaultOpen: boolean; children: ReactNode }) {
  return <SidebarProvider defaultOpen={defaultOpen}>{children}</SidebarProvider>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations("nav");
  return (
    <>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-background focus:px-5 focus:py-3 focus:outline-2">{t("skipToContent")}</a>
      <AppSidebar />
      <SidebarInset id="main-content" tabIndex={-1} className="mobile-dock-content">
        {children}
        <Suspense fallback={null}><PageWheelNav /></Suspense>
        <AlertNotifier />
        <BottomBar />
        <PrivacyHotkey />
      </SidebarInset>
      <MobileDock />
    </>
  );
}

/** One quiet row: the page title (and its context line) on the start, the page's few actions on the end. Sticks on scroll. */
export function PageHeader({
  title,
  meta,
  actions,
  largeTitle = true,
}: {
  title: string;
  meta?: string;
  actions?: ReactNode;
  /** Off where the page opens with its own big heading (Home's greeting, a purple hero card); the title stays for screen readers. */
  largeTitle?: boolean;
}) {
  const tPurpose = useTranslations("purpose");
  const tNav = useTranslations("nav");
  const pathname = usePathname();
  // Pages that share an area with tabs show the area's name, so the title never disagrees with the menu.
  const area = sectionOf(pathname) ? NAV.find((n) => n.match(pathname)) : undefined;
  const heading = area ? tNav(area.labelKey) : title;
  const { plan } = usePlan();
  // One plain line on what this page is for, only for those who asked for more explanations.
  const key = wantsExplanations(plan) ? pagePurposeKey(pathname) : null;
  const purpose = key && largeTitle && tPurpose.has(key) ? tPurpose(key) : null;
  const [scrolled, setScrolled] = useState(false);
  // Every page sets its own tab title, so tabs, history and screen readers can tell pages apart.
  useEffect(() => { document.title = `${heading} · Penny`; }, [heading]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  // Publishes the sticky header's height as --app-header-h, so sticky list headers (week rows) sit just under it.
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    // On <body>: the theme script rewrites <html>'s style attribute.
    const publish = () => document.body.style.setProperty("--app-header-h", `${el.offsetHeight}px`);
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <header ref={headerRef} className={`sticky top-0 z-20 transition-[box-shadow,background-color] duration-150 ${scrolled ? "header-bar shadow-[0_0.5px_0_var(--border)]" : "bg-transparent"}`}>
      {/* Nothing to show on desktop (hidden title, no actions): the row folds away there; phones keep it for the menu button. */}
      <div className={`${!largeTitle && !actions ? "md:hidden " : ""}mx-auto grid min-h-14 max-w-[76rem] grid-cols-[minmax(auto,1fr)_minmax(0,auto)_minmax(auto,1fr)] items-center gap-x-4 px-4 py-2 md:px-6 lg:px-8`}>
        {/* Phones: the mini pet docks beside the menu button (desktop has it in the sidebar footer). */}
        <div className="col-start-1 row-start-1 -ms-1 flex items-center gap-1 self-center justify-self-start md:hidden">
          <SidebarTrigger />
          <PetMini />
        </div>
        {/* self-start: the title sits on the same line on every page, with or without a meta line under it. */}
        <div className={largeTitle ? "col-start-2 row-start-1 flex min-w-0 flex-col items-center self-start text-center" : "sr-only"}>
          <div className="relative min-w-0 max-w-full">
            <h1 title={heading} className="truncate text-[1.625rem] leading-8 font-bold tracking-tight">{heading}</h1>
            {/* The "i" hangs off the title's end so the title itself stays on the center line. */}
            <span className="absolute start-full top-1/2 flex -translate-y-1/2 items-center">
              {meta && meta.length > 24 && <InfoTip text={meta} />}
              {purpose && <InfoTip text={purpose} />}
            </span>
          </div>
          {/* Short context (a month) on its own line under the title. */}
          {meta && meta.length <= 24 && <p className="truncate text-footnote text-muted-foreground">{meta}</p>}
        </div>
        {/* Accessibility menu on phones (the sidebar footer has it on larger screens). */}
        <A11yButton size="icon" className="col-start-3 row-start-1 self-center justify-self-end sm:hidden" />
        <div className="col-start-3 row-start-1 flex flex-wrap items-center justify-end gap-2 max-sm:col-span-3 max-sm:col-start-1 max-sm:row-start-2 max-sm:justify-center">{actions}</div>
      </div>
      <Suspense fallback={null}><SectionTabs /></Suspense>
    </header>
  );
}
