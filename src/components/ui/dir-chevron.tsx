import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = { className?: string };

/** The app's only direction arrows: a chevron that points along the reading direction (forward) or against it (back). */
export function Forward({ className }: Props) {
  return <ChevronLeft className={cn("size-4 shrink-0 ltr:rotate-180", className)} aria-hidden />;
}

export function Back({ className }: Props) {
  return <ChevronLeft className={cn("size-4 shrink-0 rtl:rotate-180", className)} aria-hidden />;
}
