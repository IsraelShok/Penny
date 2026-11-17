"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { SETTINGS_GROUPS } from "@/components/settings/settings-sidebar";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, PanelLeftIcon, Search, Minimize2, Maximize2 } from "lucide-react";
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
  Calculator,
  BookOpen,
  Settings as SettingsIcon,
  ChevronRight,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { IconButton } from "@/components/ui/icon-button";
import { A11yButton } from "@/components/a11y/a11y-menu";
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
    match: (p: string) => ["/more", "/calculators", "/recap", "/ask", "/wellbeing", "/help", "/control", "/markets", "/learn", "/car", "/discounted-home"].some((r) => p.startsWith(r)),
  },
];

/** Pages that are not in the menu but still found by search. */
export const SEARCH_PAGES: NavDef[] = [
  { href: "/calculators", labelKey: "calculators", Icon: Calculator, match: (p: string) => p.startsWith("/calculators") },
  { href: "/learn", labelKey: "learn", Icon: BookOpen, match: (p: string) => p.startsWith("/learn") },
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
  const { plan, update } = usePlan();
  // Settings lives as an icon by the workspace, but the wheel still reaches it last.
  const pages = [...NAV, ...FOOTER_NAV];
  const lastWheel = useRef(0);
  const tc = useTranslations("common");
  const tSet = useTranslations("settings.sidebar");
  const tRoot = useTranslations();
  // The gear swaps the menu to the settings sections; settings routes always show them.
  const onSettings = pathname.startsWith("/settings");
  const [settingsMenu, setSettingsMenu] = useState(onSettings);
  const menuRef = useRef<HTMLDivElement>(null);
  const focusAfterSwap = useRef(false);
  const [prevOnSettings, setPrevOnSettings] = useState(onSettings);
  if (onSettings !== prevOnSettings) { setPrevOnSettings(onSettings); if (onSettings) setSettingsMenu(true); }
  useEffect(() => {
    if (!focusAfterSwap.current) return;
    focusAfterSwap.current = false;
    menuRef.current?.querySelector<HTMLElement>("a, button")?.focus();
  }, [settingsMenu]);
  const swapMenu = (to: boolean) => { focusAfterSwap.current = true; setSettingsMenu(to); };

  // Wheel over the menu steps through the pages, top to bottom.
  function onWheel(e: React.WheelEvent) {
    if (!plan.wheelPaging || Math.abs(e.deltaY) < 4) return;
    const now = e.timeStamp;
    if (now - lastWheel.current < WHEEL_COOLDOWN_MS) return;
    lastWheel.current = now;
    // On the settings menu the wheel steps through its sections instead.
    const list = settingsMenu ? SETTINGS_GROUPS.flatMap((g) => g.items) : pages;
    const i = list.findIndex((p) => p.match(pathname));
    const next = list[Math.min(list.length - 1, Math.max(0, (i < 0 ? 0 : i) + (e.deltaY > 0 ? 1 : -1)))];
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
        <div ref={menuRef} className="contents">
        {settingsMenu ? <>
          <SidebarGroup className="pb-0">
            <SidebarMenu>
              <SidebarMenuItem>
                {/* A real button, not a quiet row: leaving settings should be the easiest thing on the menu. */}
                <SidebarMenuButton
                  onClick={() => swapMenu(false)}
                  tooltip={tc("back")}
                  variant="outline"
                  size="lg"
                  className="bg-sidebar-accent/60 font-semibold shadow-sm hover:bg-sidebar-accent focus-visible:ring-2"
                >
                  <ChevronRight className="text-primary ltr:rotate-180" aria-hidden />
                  <span>{tc("back")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
          <h2 className="sr-only">{t("settings")}</h2>
          {SETTINGS_GROUPS.map((group) => (
            <SidebarGroup key={group.titleKey} className="py-0">
              <SidebarGroupLabel>{tSet(group.titleKey)}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const label = item.labelKey.includes(".") ? tRoot(item.labelKey) : tSet(item.labelKey);
                    const active = onSettings && item.match(pathname);
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          render={<Link href={item.href} onClick={() => setOpenMobile(false)} aria-current={active ? "page" : undefined}><item.Icon /><span>{label}</span></Link>}
                          isActive={active}
                          tooltip={label}
                        />
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </> : [{ label: null, items: NAV }].map((group) => (
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
        </div>
        {/* How much Home shows: a menu choice under the pages, so it stays put instead of floating over the page. */}
        {!settingsMenu && (
          <SidebarGroup className="py-0">
            <SidebarGroupLabel>{t("viewMode")}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {(
                  [
                    { minimal: true, label: t("viewMinimal"), Icon: Minimize2 },
                    { minimal: false, label: t("viewFull"), Icon: Maximize2 },
                  ] as const
                ).map(({ minimal, label, Icon }) => {
                  const active = plan.simpleMode === minimal;
                  return (
                    <SidebarMenuItem key={label}>
                      <SidebarMenuButton
                        onClick={() => {
                          setOpenMobile(false);
                          if (!active) void update({ simpleMode: minimal });
                        }}
                        isActive={active}
                        aria-pressed={active}
                        tooltip={label}
                      >
                        <Icon />
                        <span>{label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="gap-1 border-t border-sidebar-border">
        <WorkspaceSwitcher />
        {/* Quick tools: lock, a11y, collapse and settings. One row open, one column collapsed. Privacy mode lives in Settings. */}
        <div className="flex items-center gap-0.5 group-data-[collapsible=icon]:flex-col">
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
          <A11yButton />
          <IconButton label={t("toggleSidebar")} size="icon-sm" variant="ghost" onClick={toggleSidebar}>
            <PanelLeftIcon className="size-4 rtl:rotate-180" aria-hidden />
          </IconButton>
          <IconButton
            label={t("settings")}
            variant={pathname.startsWith("/settings") ? "secondary" : "ghost"}
            size="icon-sm"
            className="ms-auto group-data-[collapsible=icon]:ms-0"
            aria-expanded={settingsMenu}
            onClick={() => swapMenu(!settingsMenu)}
          >
            <SettingsIcon className="size-4" aria-hidden />
          </IconButton>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
