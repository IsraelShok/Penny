import { InfoTip } from "@/components/ui/info-tip";
import type { ReactNode } from "react";

interface SectionShellProps {
  title: string;
  description?: string;
  /** Marks the section at a glance, the way a bank app tags each account screen. */
  icon?: ReactNode;
  children: ReactNode;
}

export function SectionShell({
  title,
  description,
  icon,
  children,
}: SectionShellProps) {
  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        {icon && (
          <span
            aria-hidden
            className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-primary/12 text-primary ring-1 ring-primary/15 ring-inset [&_svg]:size-5"
          >
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-[1.75rem] leading-9 font-bold tracking-tight">{title}</h2>
          {/* The one-line explanation under the title, not hidden behind a dot. */}
          {description && (
            <p className="mt-0.5 text-footnote leading-5 text-pretty text-muted-foreground">{description}</p>
          )}
        </div>
      </header>
      {/* A hairline between the screen's title and the grouped settings, so the two never read as one block. */}
      <div className="space-y-7 border-t border-border pt-7">{children}</div>
    </div>
  );
}

interface SettingCardProps {
  title?: string;
  description?: string;
  /** Shown at the end of the title line, e.g. a <StatusChip>. */
  aside?: ReactNode;
  id?: string;
  children: ReactNode;
}

export function SettingCard({
  title,
  description,
  aside,
  id,
  children,
}: SettingCardProps) {
  return (
    // iOS grouped section: the title sits above the card, the card holds only the controls.
    <section id={id} className="scroll-mt-20">
      {(title || description) && (
        <div className="mb-2 flex items-center gap-1 px-4">
          {/* A section eyebrow, not a heading: small enough to stay quiet, large enough to read on a phone. */}
          {title && <h3 className="text-xs font-semibold tracking-[0.04em] text-muted-foreground">{title}</h3>}
          {/* With a title, the explanation goes behind the "i" so the header stays one line. */}
          {description && (title ? <InfoTip text={description} /> : <p className="text-sm text-muted-foreground">{description}</p>)}
          {aside && <span className="ms-auto">{aside}</span>}
        </div>
      )}
      <div className="rounded-[20px] border border-border/50 bg-card px-4 py-3 shadow-[0_1px_2px_rgb(20_18_43/0.04),0_12px_28px_-24px_rgb(20_18_43/0.45)]">
        {children}
      </div>
    </section>
  );
}

/** iOS row: label + short hint at the start, the control at the end. Rows in one card get hairlines from <SettingList>. */
export function SettingRow({
  label,
  hint,
  icon,
  htmlFor,
  labelId,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  htmlFor?: string;
  labelId?: string;
  children?: ReactNode;
}) {
  const Label = htmlFor ? "label" : "span";
  return (
    <div className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {icon && (
          <span
            aria-hidden
            className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-muted text-foreground/70 [&_svg]:size-4"
          >
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <Label htmlFor={htmlFor} id={labelId} className="block text-[0.9375rem] font-medium">
            {label}
          </Label>
          {hint && <span className="mt-0.5 block text-footnote leading-5 text-muted-foreground">{hint}</span>}
        </div>
      </div>
      {children}
    </div>
  );
}

export function SettingList({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-border/70">{children}</div>;
}

/** On/off status next to a section title: green dot when on, muted when off. */
export function StatusChip({ on, label }: { on: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${on ? "bg-[color-mix(in_oklch,var(--status-on-track)_14%,transparent)] text-status-on-track" : "bg-muted text-muted-foreground"}`}>
      <span className={`size-1.5 rounded-full ${on ? "bg-status-on-track" : "bg-muted-foreground/60"}`} aria-hidden />
      {label}
    </span>
  );
}
