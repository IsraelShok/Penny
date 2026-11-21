"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Bell, ChevronDown, FileUp, Landmark, Plus, Search, Settings as SettingsIcon, WalletCards } from "lucide-react";
import { SyncButton } from "@/components/dashboard/sync-button";
import { buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { OPEN_COMMAND_PALETTE } from "./command-palette";
import { setSideRail, useAlertCount, useSideRail } from "./side-rail";
import { cn } from "@/lib/utils";

/** The row above every page on wide screens: add a transaction (and its siblings) on the start; sync, alerts and settings on the end. */
export function TopBar() {
  const t = useTranslations("topBar");
  const tShell = useTranslations("shell");
  const router = useRouter();
  const queryClient = useQueryClient();
  const count = useAlertCount();
  const railOpen = useSideRail();
  const icon = cn(buttonVariants({ variant: "outline", size: "icon" }), "rounded-xl");

  return (
    <div className="hidden md:block">
      <div className="mx-auto flex min-h-14 max-w-[1920px] items-center gap-2 px-6 pt-3 lg:px-8">
        <div className="inline-flex rounded-xl shadow-sm">
          <Link href="/transactions?add=1" className={cn(buttonVariants(), "rounded-e-none rounded-s-xl")}>
            <Plus className="size-4" aria-hidden />
            {tShell("addTransaction")}
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger aria-label={t("moreAdd")} className={cn(buttonVariants({ size: "icon" }), "rounded-s-none rounded-e-xl border-s border-primary-foreground/25")}>
              <ChevronDown className="size-4" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => router.push("/settings/data")}><FileUp className="size-4" aria-hidden />{t("importFile")}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/settings/bank")}><Landmark className="size-4" aria-hidden />{t("connectBank")}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/investments")}><WalletCards className="size-4" aria-hidden />{t("addAccount")}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {/* Search sits in the middle of the bar, where the eye looks for it, not wedged into the side menu. */}
        <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE))} aria-haspopup="dialog" aria-keyshortcuts="Control+K Meta+K /"
          className="mx-auto flex min-h-10 w-full max-w-md items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm text-muted-foreground shadow-[0_1px_2px_rgb(0_0_0/4%)] transition-colors hover:border-foreground/20 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
          <Search className="size-4 shrink-0" aria-hidden />
          <span className="flex-1 text-start">{t("search")}</span>
          <kbd dir="ltr" className="rounded-md border border-border bg-muted px-1.5 font-sans text-[11px]">Ctrl K</kbd>
        </button>
        <div className="flex items-center gap-2">
          <SyncButton onComplete={() => queryClient.invalidateQueries()} showLabel={false} />
          <button type="button" onClick={() => setSideRail(!railOpen)} aria-expanded={railOpen} aria-label={count ? t("alertsCount", { count }) : t("alerts")} title={t("alerts")} className={cn(icon, "relative")}>
            <Bell className="size-4" aria-hidden />
            {count > 0 && <span aria-hidden className="absolute -end-1 -top-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground tabular-nums">{count > 9 ? "9+" : count}</span>}
          </button>
          <Link href="/settings" aria-label={t("settings")} title={t("settings")} className={icon}>
            <SettingsIcon className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}
