"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Bell, ChevronDown, FileUp, Landmark, Plus, Settings as SettingsIcon, WalletCards } from "lucide-react";
import { getSuggestions } from "@/lib/api";
import { SyncButton } from "@/components/dashboard/sync-button";
import { SuggestionsCard } from "@/components/home/suggestions-card";
import { buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** The row above every page on wide screens: add a transaction (and its siblings) on the start; sync, alerts and settings on the end. */
export function TopBar() {
  const t = useTranslations("topBar");
  const tShell = useTranslations("shell");
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["suggestions"], queryFn: getSuggestions });
  const count = data?.suggestions.length ?? 0;
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
        <div className="ms-auto flex items-center gap-2">
          <SyncButton onComplete={() => queryClient.invalidateQueries()} showLabel={false} />
          <Popover>
            <PopoverTrigger aria-label={count ? t("alertsCount", { count }) : t("alerts")} className={cn(icon, "relative")}>
              <Bell className="size-4" aria-hidden />
              {count > 0 && <span aria-hidden className="absolute -end-1 -top-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground">{count > 9 ? "9+" : count}</span>}
            </PopoverTrigger>
            <PopoverContent className="w-96 bg-popover">
              <p className="mb-2 text-sm font-semibold">{t("alerts")}</p>
              <SuggestionsCard bare limit={5} href="/more" empty={<p className="py-4 text-center text-footnote text-muted-foreground">{t("noAlerts")}</p>} />
            </PopoverContent>
          </Popover>
          <Link href="/settings" aria-label={t("settings")} title={t("settings")} className={icon}>
            <SettingsIcon className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}
