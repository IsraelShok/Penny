"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { House, ArrowLeftRight, Wallet, Flag, Grid2X2 } from "lucide-react";
import { NAV, SIMPLE_NAV } from "./app-sidebar";
import { usePlan } from "@/hooks/use-plan";

export function MobileDock() {
  const path = usePathname(); const t = useTranslations("nav"); const simple = usePlan().plan.simpleMode;
  const items = [ { href: "/", name: t("home"), Icon: House }, { href: "/transactions", name: t("activity"), Icon: ArrowLeftRight }, { href: "/budget", name: t("budget"), Icon: Wallet }, { href: "/investments", name: t("fi"), Icon: Flag }, { href: "/more", name: t("more"), Icon: Grid2X2 } ].filter((i) => !simple || SIMPLE_NAV.has(i.href));
  if (simple) return null;
  return <nav className="mobile-dock" aria-label={t("mobileNavigation")}>{items.map(({ href, name, Icon }) => <Link key={href} href={href} aria-current={NAV.find((n) => n.href === href)?.match(path) ? "page" : undefined}><Icon size={21} aria-hidden /><span>{name}</span></Link>)}</nav>;
}
