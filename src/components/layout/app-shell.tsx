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
import { InfoTip } from "@/components/ui/info-tip";
import { usePathname } from "next/navigation";
import { usePlan } from "@/hooks/use-plan";
import { wantsExplanations } from "@/lib/plan";
import { pagePurposeKey } from "@/lib/orientation";

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
  /** Off where the page opens with its own big heading (Home's greeting); the title stays for screen readers. */
  largeTitle?: boolean;
}) {
  const tPurpose = useTranslations("purpose");
  const pathname = usePathname();
  const { plan } = usePlan();
  // One plain line on what this page is for, only for those who asked for more explanations.
  const key = wantsExplanations(plan) ? pagePurposeKey(pathname) : null;
  const purpose = key && largeTitle && tPurpose.has(key) ? tPurpose(key) : null;
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`glass sticky top-0 z-20 transition-[box-shadow] duration-150 ${scrolled ? "shadow-[0_0.5px_0_var(--border)]" : ""}`}>
      <div className="mx-auto grid min-h-14 max-w-[76rem] grid-cols-[1fr_auto_1fr] items-center gap-x-4 px-4 py-2 md:px-6 lg:px-8">
        <SidebarTrigger className="-ms-1 justify-self-start md:hidden" />
        <div className={largeTitle ? "col-start-2 flex min-w-0 items-center justify-center gap-1 text-center" : "sr-only"}>
          <h1 className="truncate text-[1.625rem] leading-8 font-bold tracking-tight">{title}</h1>
          {/* Short context (a month) stays visible; anything longer hides behind the "i". */}
          {meta && (meta.length > 24 ? <InfoTip text={meta} /> : <p className="truncate text-footnote text-muted-foreground">{meta}</p>)}
          {purpose && <InfoTip text={purpose} />}
        </div>
        <div className="col-start-3 flex min-w-0 flex-wrap items-center justify-end gap-2">{actions}</div>
      </div>
    </header>
  );
}
