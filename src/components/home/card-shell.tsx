"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronRight } from "lucide-react";

interface CardShellProps {
  label?: string;
  /** The page's one dark Apple Pay-style card, for its headline figure. */
  wallet?: boolean;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function CardShell({ label, wallet, action, children, className }: CardShellProps) {
  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-[1.375rem] bg-card p-7",
        wallet && "wallet",
        className
      )}
    >
      {(label || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {label && (
            <h3 className="text-footnote font-semibold text-muted-foreground">
              {label}
            </h3>
          )}
          {action && (
            <div className="text-footnote text-primary">{action}</div>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

export function CardAction({ href, children }: { href: string; children: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            href={href}
            aria-label={children}
            className="-m-1 inline-flex rounded-full p-1 hover:text-foreground"
          />
        }
      >
        <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
      </TooltipTrigger>
      <TooltipContent>{children}</TooltipContent>
    </Tooltip>
  );
}

export function CardSkeleton({
  label,
  height = 140,
  className,
}: {
  label?: string;
  height?: number;
  className?: string;
}) {
  return (
    <CardShell label={label} className={className}>
      <Skeleton className="w-full" style={{ height }} />
    </CardShell>
  );
}

export function CardError({ label, className }: { label?: string; className?: string }) {
  const t = useTranslations("home");
  return (
    <CardShell label={label} className={className}>
      <div className="flex flex-1 items-center justify-center py-8 text-sm text-muted-foreground">
        {t("couldntLoad")}
      </div>
    </CardShell>
  );
}
