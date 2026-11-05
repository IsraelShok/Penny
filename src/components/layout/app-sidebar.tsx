"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef } from "react";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  PieChart,
  Landmark,
  LineChart,
  Flag,
  Wallet,
  ArrowLeftRight,
  Lightbulb,
  ListFilter,
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
} from "@/components/ui/sidebar";
import { WorkspaceSwitcher } from "./workspace-switcher";

interface NavDef {
  href: string;
  labelKey: string;
  Icon: React.ComponentType<{ className?: string }>;
  match: (p: string) => boolean;
}

const NAV: NavDef[] = [
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
    href: "/markets",
    labelKey: "markets",
    Icon: LineChart,
    match: (p: string) => p.startsWith("/markets"),
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
  {
    href: "/rules",
    labelKey: "rules",
    Icon: ListFilter,
    match: (p: string) => p.startsWith("/rules"),
  },
];

const FOOTER_NAV: NavDef[] = [
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
  const pages = [...NAV, ...FOOTER_NAV];
  const lastWheel = useRef(0);

  // Wheel over the menu steps through the pages, top to bottom.
  function onWheel(e: React.WheelEvent) {
    if (Math.abs(e.deltaY) < 4) return;
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
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {pages.map((item) => {
                const label = t(item.labelKey);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={
                        <Link href={item.href}>
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
      </SidebarContent>

      <SidebarFooter>
        <WorkspaceSwitcher />
      </SidebarFooter>
    </Sidebar>
  );
}
