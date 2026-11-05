"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { PageWheelNav } from "./page-wheel-nav";

/** Lives in the root layout so the collapsed state survives page changes. */
export function SidebarRoot({ defaultOpen, children }: { defaultOpen: boolean; children: ReactNode }) {
  return <SidebarProvider defaultOpen={defaultOpen}>{children}</SidebarProvider>;
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <AppSidebar />
      <SidebarInset>
        {children}
        <PageWheelNav />
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
        <div className="relative flex h-14 items-center justify-between gap-4 px-4 md:h-16 md:px-6 lg:px-8">
          <SidebarTrigger className="-ms-1 md:hidden" />
          <span
            aria-hidden
            className={`pointer-events-none absolute inset-x-0 mx-auto w-fit max-w-[50%] truncate text-headline font-semibold transition-opacity duration-150 ${scrolled ? "opacity-100" : "opacity-0"}`}
          >
            {title}
          </span>
          {actions && <div className="ms-auto flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      </header>
      <div className={largeTitle ? "px-4 pb-1 md:px-6 lg:px-8" : "sr-only"}>
        <h1 className="text-[2.125rem] leading-[2.5rem] font-bold tracking-tight">{title}</h1>
        {meta && <p className="mt-0.5 text-footnote text-muted-foreground">{meta}</p>}
      </div>
    </>
  );
}
