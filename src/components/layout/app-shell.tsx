"use client";

import type { ReactNode } from "react";
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

export function PageHeader({
  title,
  meta,
  actions,
}: {
  title: string;
  meta?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="glass sticky top-0 z-20">
      <div className="flex h-14 items-center justify-between gap-4 px-4 md:h-16 md:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <SidebarTrigger className="-ms-1 md:hidden" />
          <h1 className="truncate font-serif text-title">
            {title}
          </h1>
          {meta && (
            <>
              <span className="text-sm text-muted-foreground">·</span>
              <span className="truncate text-sm text-muted-foreground">
                {meta}
              </span>
            </>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        )}
      </div>
    </header>
  );
}
