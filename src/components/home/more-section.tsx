"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { usePlan } from "@/hooks/use-plan";
import { cn } from "@/lib/utils";

const KEY = "home-more-open";

/** Everything beyond today's answer, folded away until asked for. Remembers the choice; hidden in simple mode. */
export function MoreSection({ children }: { children: ReactNode }) {
  const t = useTranslations("today");
  const tJ = useTranslations("journey");
  const { plan } = usePlan();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read once after hydration
      setOpen(localStorage.getItem(KEY) === "1");
    } catch {}
  }, []);

  if (plan.simpleMode) {
    return (
      <p className="text-center text-footnote text-muted-foreground">
        {t("simpleOn")} <Link href="/settings/appearance" className="text-primary hover:underline">{t("simpleChange")}</Link>
      </p>
    );
  }
  return (
    <section>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="home-more"
        onClick={() => {
          setOpen(!open);
          try {
            localStorage.setItem(KEY, open ? "0" : "1");
          } catch {}
        }}
        className="mx-auto mb-4 flex items-center gap-1.5 rounded-full px-4 py-2 text-footnote font-medium text-muted-foreground transition-[background-color,color] duration-150 hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
      >
        {open ? t("less") : t("more")}
        <ChevronDown className={cn("size-4 transition-transform duration-150 motion-reduce:transition-none", open && "rotate-180")} aria-hidden />
      </button>
      <div id="home-more" hidden={!open}>
        {children}
        <Link href="/journey" className="mx-auto mt-6 block w-fit rounded-full px-4 py-2 text-footnote font-medium text-primary hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring">
          {tJ("homeLink")}
        </Link>
      </div>
    </section>
  );
}
