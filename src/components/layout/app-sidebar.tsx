"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, PanelLeftIcon, Search } from "lucide-react";
import { getActivity, getHome } from "@/lib/api";
import { getLockStatus } from "@/components/settings/app-lock-card";
import { SyncStatusPill } from "@/components/home/sync-status-pill";
import { OPEN_COMMAND_PALETTE } from "./command-palette";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  PieChart,
  Landmark,
  Flag,
  Wallet,
  ArrowLeftRight,
  LayoutGrid,
  Settings as SettingsIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { IconButton } from "@/components/ui/icon-button";
import { usePlan } from "@/hooks/use-plan";
import { WorkspaceSwitcher } from "./workspace-switcher";

interface NavDef {
  href: string;
  labelKey: string;
  Icon: React.ComponentType<{ className?: string }>;
  match: (p: string) => boolean;
}

/** The four main areas. Everything else lives inside one of them (as a tab) or in search. */
export const NAV: NavDef[] = [
  { href: "/", labelKey: "home", Icon: LayoutDashboard, match: (p: string) => p === "/" },
  { href: "/transactions", labelKey: "transactions", Icon: ArrowLeftRight, match: (p: string) => p.startsWith("/transactions") },
  {
    href: "/budget",
    labelKey: "budget",
    Icon: Wallet,
    match: (p: string) => ["/budget", "/overview", "/insights"].some((r) => p.startsWith(r)),
  },
  {
    href: "/investments",
    labelKey: "future",
    Icon: Flag,
    match: (p: string) => ["/investments", "/fi", "/journey", "/life"].some((r) => p.startsWith(r)),
  },
  {
    href: "/more",
    labelKey: "more",
    Icon: LayoutGrid,
    // Calculators and the occasional tools; the hub stays lit while you use one.
    match: (p: string) => ["/more", "/calculators", "/recap", "/ask", "/wellbeing", "/checkin", "/help", "/control", "/markets"].some((r) => p.startsWith(r)),
  },
];

/** Simple mode is one scrolling page, like RiseUp: Home only. */
export const SIMPLE_NAV = new Set(["/"]);

/** Pages that are not in the menu but still found by search. */
export const SEARCH_PAGES: NavDef[] = [
  { href: "/overview", labelKey: "overview", Icon: PieChart, match: (p: string) => p.startsWith("/overview") },
  { href: "/fi", labelKey: "fi", Icon: Landmark, match: (p: string) => p.startsWith("/fi") },
];

export const FOOTER_NAV: NavDef[] = [
  {
    href: "/settings",
    labelKey: "settings",
    Icon: SettingsIcon,
    match: (p: string) => p.startsWith("/settings"),
  },
];

/** One wheel notch moves one page; this is the pause before the next can. */
const WHEEL_COOLDOWN_MS = 350;

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("nav");
  const { setOpenMobile, toggleSidebar } = useSidebar();
  const lock = useQuery({ queryKey: ["lock"], queryFn: getLockStatus });
  const home = useQuery({ queryKey: ["home"], queryFn: getHome });
  const queryClient = useQueryClient();
  const [statusOpen, setStatusOpen] = useState(false);
  const { data: activity } = useQuery({
    queryKey: ["activity"],
    queryFn: getActivity,
    refetchInterval: (q) => (statusOpen || q.state.data?.sync.active ? 3000 : 15000),
    refetchIntervalInBackground: false,
  });
  const onStatusOpen = useCallback((o: boolean) => {
    setStatusOpen(o);
    if (o) queryClient.invalidateQueries({ queryKey: ["activity"] });
  }, [queryClient]);
  const { plan } = usePlan();
  // Settings lives as an icon by the workspace, but the wheel still reaches it last.
  const nav = plan.simpleMode ? NAV.filter((n) => SIMPLE_NAV.has(n.href)) : NAV;
  const pages = [...nav, ...FOOTER_NAV];
  const lastWheel = useRef(0);

  // Wheel over the menu steps through the pages, top to bottom.
  function onWheel(e: React.WheelEvent) {
    if (!plan.wheelPaging || Math.abs(e.deltaY) < 4) return;
    const now = e.timeStamp;
    if (now - lastWheel.current < WHEEL_COOLDOWN_MS) return;
    lastWheel.current = now;
    const i = pages.findIndex((p) => p.match(pathname));
    const next = pages[Math.min(pages.length - 1, Math.max(0, (i < 0 ? 0 : i) + (e.deltaY > 0 ? 1 : -1)))];
    if (next && !next.match(pathname)) router.push(next.href);
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="pt-3" onWheel={onWheel}>
        {/* Sync status first, in words, so it's the first thing read; collapsed it shrinks to its dot. */}
        <SidebarGroup className="pb-0">
          <SyncStatusPill labelled items={home.data?.bankHealth ?? null} nextScheduledSync={home.data?.nextScheduledSync ?? null} activity={activity ?? null} onOpenChange={onStatusOpen} />
        </SidebarGroup>
        <SidebarSeparator className="mx-3 w-auto" />
        <SidebarGroup className="pb-0">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => { setOpenMobile(false); window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE)); }}
                tooltip={`${t("search")} (Ctrl K)`}
                aria-keyshortcuts="Control+K Meta+K /"
                aria-haspopup="dialog"
              >
                <Search />
                <span className="flex-1">{t("search")}</span>
                <kbd dir="ltr" className="rounded border border-sidebar-border px-1.5 text-[0.6875rem] text-muted-foreground group-data-[collapsible=icon]:hidden">/</kbd>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        {[{ label: null, items: plan.simpleMode ? [] : nav }].map((group) => (
        <SidebarGroup key="main">
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => {
                const label = t(item.labelKey);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={
                        <Link href={item.href} onClick={() => setOpenMobile(false)} aria-current={item.match(pathname) ? "page" : undefined}>
                          <item.Icon />
                          <span>{label}</span>
                        </Link>
                      }
                      isActive={item.match(pathname)}
                      tooltip={label}
                    />
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <WorkspaceSwitcher />
        {/* Quick tools: lock, collapse and settings. One row open, one column collapsed. Privacy mode lives in Settings. */}
        <div className="flex items-center gap-1 group-data-[collapsible=icon]:flex-col">
          {lock.data?.enabled && (
            <IconButton
              label={t("lockNow")}
              size="icon-sm"
              variant="ghost"
              onClick={async () => {
                await fetch("/api/lock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "lock" }) });
                router.replace("/lock");
              }}
            >
              <Lock className="size-4" aria-hidden />
            </IconButton>
          )}
          <IconButton label={t("toggleSidebar")} size="icon-sm" variant="ghost" onClick={toggleSidebar}>
            <PanelLeftIcon className="size-4 rtl:rotate-180" aria-hidden />
          </IconButton>
          <IconButton
            label={t("settings")}
            variant={pathname.startsWith("/settings") ? "secondary" : "ghost"}
            size="icon-sm"
            className="ms-auto group-data-[collapsible=icon]:ms-0"
            nativeButton={false}
            render={<Link href="/settings" />}
          >
            <SettingsIcon className="size-4" aria-hidden />
          </IconButton>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
