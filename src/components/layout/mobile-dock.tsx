"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import { House, ArrowLeftRight, Wallet, Flag, Grid2X2 } from "lucide-react";
import { NAV } from "./app-sidebar";

export function MobileDock() {
  const path = usePathname(); const he = useLocale() === "he";
  const items = [ { href: "/", name: he ? "בית" : "Home", Icon: House }, { href: "/transactions", name: he ? "תנועות" : "Activity", Icon: ArrowLeftRight }, { href: "/budget", name: he ? "תקציב" : "Budget", Icon: Wallet }, { href: "/investments", name: he ? "עתיד" : "Future", Icon: Flag }, { href: "/more", name: he ? "עוד" : "More", Icon: Grid2X2 } ];
  return <nav className="mobile-dock" aria-label={he ? "ניווט ראשי במובייל" : "Mobile navigation"}>{items.map(({ href, name, Icon }) => <Link key={href} href={href} aria-current={NAV.find((n) => n.href === href)?.match(path) ? "page" : undefined}><Icon size={21} aria-hidden /><span>{name}</span></Link>)}</nav>;
}
