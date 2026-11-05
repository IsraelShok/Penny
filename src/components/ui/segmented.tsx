"use client";

import { cn } from "@/lib/utils";

/** iOS segmented control: one choice from a few. Arrow keys move between options, as in a radio group. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  const index = options.findIndex((o) => o.value === value);
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("inline-flex rounded-[0.6rem] bg-[var(--segmented)] p-0.5", className)}
      onKeyDown={(e) => {
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (!step) return;
        e.preventDefault();
        // In RTL the visual order is mirrored, so left/right swap.
        const dir = getComputedStyle(e.currentTarget).direction === "rtl" && e.key.startsWith("Arrow") && (e.key === "ArrowLeft" || e.key === "ArrowRight") ? -step : step;
        const next = options[(index + dir + options.length) % options.length];
        onChange(next.value);
        (e.currentTarget.querySelector(`[data-value="${next.value}"]`) as HTMLElement | null)?.focus();
      }}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            data-value={o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "min-h-8 min-w-14 rounded-[0.5rem] px-3 text-footnote font-medium tabular-nums transition-[background-color,color,box-shadow] duration-150",
              selected ? "bg-[var(--segmented-thumb)] text-foreground shadow-[0_3px_8px_rgb(0_0_0/0.12),0_3px_1px_rgb(0_0_0/0.04)]" : "text-foreground/80 hover:text-foreground"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
