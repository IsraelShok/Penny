"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import { House, ArrowLeftRight, Wallet, Flag, Search } from "lucide-react";
import { NAV } from "./app-sidebar";
import { OPEN_COMMAND_PALETTE } from "./command-palette";

export function MobileDock() {
  const path = usePathname(); const he = useLocale() === "he";
  const items = [ { href: "/", name: he ? "בית" : "Home", Icon: House }, { href: "/transactions", name: he ? "תנועות" : "Activity", Icon: ArrowLeftRight }, { href: "/budget", name: he ? "תקציב" : "Budget", Icon: Wallet }, { href: "/investments", name: he ? "עתיד" : "Future", Icon: Flag } ];
  return <nav className="mobile-dock" aria-label={he ? "ניווט ראשי במובייל" : "Mobile navigation"}>{items.map(({ href, name, Icon }) => <Link key={href} href={href} aria-current={NAV.find((n) => n.href === href)?.match(path) ? "page" : undefined}><Icon size={21} aria-hidden /><span>{name}</span></Link>)}<button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE))}><Search size={21} aria-hidden /><span>{he ? "חיפוש" : "Search"}</span></button></nav>;
}
