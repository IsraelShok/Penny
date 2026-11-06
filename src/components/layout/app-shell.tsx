"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { PageWheelNav } from "./page-wheel-nav";
import { AlertNotifier } from "./alert-notifier";
import { CommandPalette } from "./command-palette";
import { useTranslations } from "next-intl";

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
      <SidebarInset id="main-content" tabIndex={-1}>
        {children}
        <PageWheelNav />
        <AlertNotifier />
        <CommandPalette />
      </SidebarInset>
    </>
  );
}

/** iOS large title: a big heading on the page that hands over to a small centred title in the bar once scrolled. */
export function PageHeader({
  title,
  meta,
  actions,
  largeTitle = true,
}: {
  title: string;
  meta?: string;
  actions?: ReactNode;
  /** Off where the page opens with its own big heading (Home's greeting); the title stays for screen readers. */
  largeTitle?: boolean;
}) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header
        className={`glass sticky top-0 z-20 transition-[box-shadow] duration-150 ${scrolled ? "shadow-[0_0.5px_0_var(--border)]" : ""}`}
      >
        <div className="relative mx-auto flex min-h-14 max-w-[76rem] flex-wrap items-center justify-between gap-3 px-4 py-2 md:min-h-16 md:px-6 lg:px-8">
          <SidebarTrigger className="-ms-1 md:hidden" />
          <span
            aria-hidden
            className={`pointer-events-none hidden min-w-0 flex-1 truncate md:block text-headline font-semibold transition-opacity duration-150 ${scrolled ? "opacity-100" : "opacity-0"}`}
          >
            {title}
          </span>
          <div className="ms-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
            {actions}
          </div>
        </div>
      </header>
      <div className={largeTitle ? "mx-auto w-full max-w-[76rem] px-4 pb-1 pt-3 md:px-6 lg:px-8" : "sr-only"}>
        <h1 className="text-[2.125rem] leading-[2.5rem] font-bold tracking-tight">{title}</h1>
        {meta && <p className="mt-0.5 text-footnote text-muted-foreground">{meta}</p>}
      </div>
    </>
  );
}
