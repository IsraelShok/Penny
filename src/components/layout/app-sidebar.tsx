"use client";

import { Suspense } from "react";
import Link from "next/link";
import { Eye, EyeOff, Lock, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getLockStatus } from "@/components/settings/app-lock-card";
import { usePrivacyMode } from "@/hooks/use-privacy-mode";
import { OPEN_COMMAND_PALETTE } from "./command-palette";
import { SidebarSync } from "./sidebar-sync";
import { usePathname, useRouter } from "next/navigation";
import { useRef } from "react";
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
  PanelLeftIcon,
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
  useSidebar,
} from "@/components/ui/sidebar";
import { IconButton } from "@/components/ui/icon-button";
import { usePlan } from "@/hooks/use-plan";
import { WorkspaceSwitcher } from "./workspace-switcher";

interface NavDef {
  href: string;
  labelKey: string;
  Icon: React.ComponentType<{ className?: string }>;
  /** iOS Settings-style icon tile colour. */
  tint: string;
  match: (p: string) => boolean;
}

export const NAV: NavDef[] = [
  {
    href: "/",
    labelKey: "home",
    tint: "bg-[#007aff]",
    Icon: LayoutDashboard,
    match: (p: string) => p === "/",
  },
  {
    href: "/overview",
    labelKey: "overview",
    tint: "bg-[#ff9500]",
    Icon: PieChart,
    match: (p: string) => p.startsWith("/overview") || p.startsWith("/insights"),
  },
  {
    href: "/investments",
    labelKey: "investments",
    tint: "bg-[#30b0c7]",
    Icon: Landmark,
    match: (p: string) => p.startsWith("/investments"),
  },
  {
    href: "/fi",
    labelKey: "fi",
    tint: "bg-[#ff2d55]",
    Icon: Flag,
    match: (p: string) => p.startsWith("/fi"),
  },
  {
    href: "/budget",
    labelKey: "budget",
    tint: "bg-[#34c759]",
    Icon: Wallet,
    match: (p: string) => p.startsWith("/budget"),
  },
  {
    href: "/transactions",
    labelKey: "transactions",
    tint: "bg-[#5856d6]",
    Icon: ArrowLeftRight,
    match: (p: string) => p.startsWith("/transactions"),
  },
  {
    href: "/more",
    labelKey: "more",
    tint: "bg-[#8e8e93]",
    Icon: LayoutGrid,
    // The hub plus the tools it opens, so the menu stays short but you always see where you are.
    match: (p: string) => ["/more", "/recap", "/ask", "/journey", "/life", "/wellbeing", "/checkin"].some((r) => p.startsWith(r)),
  },
  {
    href: "/learn",
    labelKey: "learn",
    tint: "bg-[#ff3b30]",
    Icon: BookOpen,
    match: (p: string) => p.startsWith("/learn"),
  },
  {
    href: "/calculators",
    labelKey: "calculators",
    tint: "bg-[#a2845e]",
    Icon: Calculator,
    match: (p: string) => ["/calculators", "/car", "/discounted-home"].some((r) => p.startsWith(r)),
  },
];

export const FOOTER_NAV: NavDef[] = [
  {
    href: "/settings",
    labelKey: "settings",
    tint: "bg-[#8e8e93]",
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
  const [privacy, togglePrivacy] = usePrivacyMode();
  const lock = useQuery({ queryKey: ["lock"], queryFn: getLockStatus });
  const { toggleSidebar, setOpenMobile } = useSidebar();
  const { plan } = usePlan();
  // Settings lives as an icon by the workspace, but the wheel still reaches it last.
  const pages = [...NAV, ...FOOTER_NAV];
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
                <kbd dir="ltr" className="rounded border border-sidebar-border px-1.5 text-[0.6875rem] text-muted-foreground group-data-[collapsible=icon]:hidden">Ctrl K</kbd>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        {[{ label: "dailyGroup", items: [NAV[0], NAV[5], NAV[4]] }, { label: "planningGroup", items: [NAV[1], NAV[2], NAV[3], NAV[8], NAV[7], NAV[6]] }].map((group) => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel>{t(group.label)}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => {
                const label = t(item.labelKey);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={
                        <Link href={item.href} onClick={() => setOpenMobile(false)} aria-current={item.match(pathname) ? "page" : undefined}>
                          <span className={`grid size-7 shrink-0 place-items-center rounded-[0.5rem] text-white ${item.tint}`} aria-hidden><item.Icon /></span>
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

      {/* iOS-style footer: a grouped sync card, then who is using the app, then one even row of tools. */}
      <SidebarFooter className="gap-2 pb-3">
        <div className="rounded-2xl bg-sidebar-accent/60 p-1.5 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0">
          <Suspense fallback={null}><SidebarSync /></Suspense>
        </div>
        <WorkspaceSwitcher />
        <div className="flex items-center justify-between border-t border-sidebar-border/70 px-1 pt-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-1 group-data-[collapsible=icon]:border-t-0">
        <IconButton
          label={t("settings")}
          variant={pathname.startsWith("/settings") ? "secondary" : "ghost"}
          size="icon-sm"
          nativeButton={false}
          render={<Link href="/settings" />}
        >
          <SettingsIcon className="size-4" aria-hidden />
        </IconButton>
        <IconButton label={t("privacyMode")} size="icon-sm" aria-pressed={privacy} onClick={togglePrivacy}>
          {privacy ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        </IconButton>
        {lock.data?.enabled && (
          <IconButton
            label={t("lockNow")}
            size="icon-sm"
            onClick={async () => {
              await fetch("/api/lock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "lock" }) });
              window.location.assign("/lock");
            }}
          >
            <Lock className="size-4" aria-hidden />
          </IconButton>
        )}
        <IconButton label={t("toggleSidebar")} size="icon-sm" onClick={toggleSidebar}>
          <PanelLeftIcon className="size-4 rtl:rotate-180" aria-hidden />
        </IconButton>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
