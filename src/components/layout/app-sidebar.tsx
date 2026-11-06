"use client";

import Link from "next/link";
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
  Lightbulb,
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
  match: (p: string) => boolean;
}

export const NAV: NavDef[] = [
  {
    href: "/",
    labelKey: "home",
    Icon: LayoutDashboard,
    match: (p: string) => p === "/",
  },
  {
    href: "/overview",
    labelKey: "overview",
    Icon: PieChart,
    match: (p: string) => p.startsWith("/overview"),
  },
  {
    href: "/investments",
    labelKey: "investments",
    Icon: Landmark,
    match: (p: string) => p.startsWith("/investments"),
  },
  {
    href: "/fi",
    labelKey: "fi",
    Icon: Flag,
    match: (p: string) => p.startsWith("/fi"),
  },
  {
    href: "/budget",
    labelKey: "budget",
    Icon: Wallet,
    match: (p: string) => p.startsWith("/budget"),
  },
  {
    href: "/transactions",
    labelKey: "transactions",
    Icon: ArrowLeftRight,
    match: (p: string) => p.startsWith("/transactions"),
  },
  {
    href: "/insights",
    labelKey: "insights",
    Icon: Lightbulb,
    match: (p: string) => p.startsWith("/insights"),
  },
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
        {[{ label: "dailyGroup", items: [NAV[0], NAV[5], NAV[4], NAV[6]] }, { label: "planningGroup", items: [NAV[1], NAV[2], NAV[3]] }].map((group) => (
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

      <SidebarFooter className="flex-row items-center gap-1 group-data-[collapsible=icon]:flex-col">
        <div className="min-w-0 flex-1 group-data-[collapsible=icon]:flex-none">
          <WorkspaceSwitcher />
        </div>
        <IconButton
          label={t("settings")}
          variant={pathname.startsWith("/settings") ? "secondary" : "ghost"}
          size="icon-sm"
          nativeButton={false}
          render={<Link href="/settings" />}
        >
          <SettingsIcon className="size-4" aria-hidden />
        </IconButton>
        <IconButton label={t("toggleSidebar")} size="icon-sm" onClick={toggleSidebar}>
          <PanelLeftIcon className="size-4 rtl:rotate-180" aria-hidden />
        </IconButton>
      </SidebarFooter>
    </Sidebar>
  );
}
