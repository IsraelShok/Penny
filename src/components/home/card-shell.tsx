"use client";

import { Forward } from "@/components/ui/dir-chevron";
import Link from "next/link";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface CardShellProps {
  label?: string;
  /** The page's one dark Apple Pay-style card, for its headline figure. */
  wallet?: boolean;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}

export function CardShell({ label, wallet, action, children, className, id }: CardShellProps) {
  return (
    <div
      id={id}
      className={cn(
        "flex h-full flex-col rounded-2xl border border-border/60 bg-card p-5 sm:p-6",
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
    <Link
      href={href}
      className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-medium text-primary hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
    >
      {children}
      <Forward />
    </Link>
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
