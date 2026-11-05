"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FOOTER_NAV, NAV } from "./app-sidebar";

/** Wheel distance past the end of a page before it moves on, so a normal scroll never jumps by accident. */
const THRESHOLD = 600;
/** A pause this long resets the pull. */
const RESET_MS = 700;

/**
 * Keep scrolling past the bottom of a page to open the next one in the menu, or past the top
 * to go back. A pill shows where it is heading while the pull builds.
 */
export function PageWheelNav() {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("nav");
  const pages = [...NAV, ...FOOTER_NAV];
  const index = pages.findIndex((p) => p.match(pathname));
  const [pull, setPull] = useState(0);
  const pullRef = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (index < 0) return;
    function onWheel(e: WheelEvent) {
      // Dialogs, menus and inner scroll areas keep their own scrolling.
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest("[role=dialog], [role=menu], [role=listbox], [data-slot=sidebar], .overflow-x-auto, .overflow-y-auto")) return;
      const doc = document.documentElement;
      const atBottom = window.innerHeight + window.scrollY >= doc.scrollHeight - 2;
      const atTop = window.scrollY <= 0;
      const dir = e.deltaY > 0 ? 1 : -1;
      if (!((dir > 0 && atBottom && index < pages.length - 1) || (dir < 0 && atTop && index > 0))) {
        pullRef.current = 0;
        setPull(0);
        return;
      }
      if (Math.sign(pullRef.current) !== dir) pullRef.current = 0;
      pullRef.current += e.deltaY;
      setPull(pullRef.current);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        pullRef.current = 0;
        setPull(0);
      }, RESET_MS);
      if (Math.abs(pullRef.current) >= THRESHOLD) {
        pullRef.current = 0;
        setPull(0);
        router.push(pages[index + dir].href);
      }
    }
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
    // pages is rebuilt each render from constant lists; index captures the change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, router]);

  if (pull === 0) return null;
  const target = pages[index + Math.sign(pull)];
  if (!target) return null;
  const progress = Math.min(1, Math.abs(pull) / THRESHOLD);
  return (
    <div
      role="status"
      className={`glass-popover pointer-events-none fixed inset-x-0 z-30 mx-auto flex w-fit items-center gap-2 rounded-full px-4 py-2 text-footnote shadow-lg ${pull > 0 ? "bottom-6" : "top-20"}`}
    >
      <target.Icon className="size-4" />
      <span>{t(target.labelKey)}</span>
      <span className="h-1 w-12 overflow-hidden rounded-full bg-muted" aria-hidden>
        <span className="block h-full rounded-full bg-primary" style={{ width: `${progress * 100}%` }} />
      </span>
    </div>
  );
}
