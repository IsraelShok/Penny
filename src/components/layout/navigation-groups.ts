import { LayoutDashboard, ArrowLeftRight, Wallet, WalletCards, PieChart, Landmark, Flag, CalendarDays, ShieldCheck, Calculator, GraduationCap, Building2, HeartPulse, Flame, Car, MessageCircleQuestion, ScrollText, Workflow, ListChecks, Gauge, Focus, HandCoins, Rocket, Tags, Repeat, Wand2, TrendingUp, ReceiptText, Compass, ChartColumn, Milestone } from "lucide-react";

const item = (href: string, key: string, Icon: typeof Wallet) => ({ href, key, Icon, match: (path: string) => href === "/" ? path === "/" : path === href || path.startsWith(href + "/") });

/**
 * Labels live in messages under navGroups.groups / navGroups.pages. Shared information architecture for desktop and the mobile menu.
 * Each group has its own icon, and no two pages share one.
 * Focus (the calm one-page home), Dashboard, then Accounts, Transactions, Planning, Analytics, in their order. A group with one page shows as a plain link.
 */
export const NAVIGATION_GROUPS = [
  { key: "focus", Icon: Focus, items: [item("/focus", "focus", Focus)] },
  { key: "dashboard", Icon: LayoutDashboard, items: [item("/", "home", LayoutDashboard)] },
  // The core pages first; Penny's own pages follow at the end of each group.
  { key: "accounts", Icon: Landmark, items: [
    item("/accounts", "accounts", WalletCards),
    item("/loans", "loans", HandCoins),
    item("/investments", "investments", TrendingUp),
    item("/ventures", "ventures", Rocket),
    item("/car", "car", Car),
    item("/insurance", "insurance", ShieldCheck),
    item("/business", "business", Building2),
  ] },
  { key: "transactions", Icon: ArrowLeftRight, items: [
    item("/transactions", "transactions", ReceiptText),
    item("/groups", "groups", Tags),
    item("/optimizations", "optimizations", Wand2),
    item("/settings/rules", "rules", Workflow),
    item("/reviews", "reviews", ListChecks),
  ] },
  { key: "planning", Icon: Compass, items: [
    item("/budget", "budget", Wallet),
    item("/journey", "journey", Flag),
    item("/trackers", "trackers", Gauge),
    item("/recurring", "recurring", Repeat),
    item("/planned", "planned", CalendarDays),
    item("/life", "life", Milestone),
  ] },
  // Settings sit behind the gear in the sidebar footer; Help closes the settings menu.
  { key: "analytics", Icon: ChartColumn, items: [
    item("/overview", "overview", PieChart),
    item("/fi", "fi", Flame),
    item("/recap", "recap", ScrollText),
    item("/wellbeing", "wellbeing", HeartPulse),
    item("/ask", "ask", MessageCircleQuestion),
    item("/calculators", "calculators", Calculator),
    item("/learn", "learn", GraduationCap),
  ] },
];
