import { InfoTip } from "@/components/ui/info-tip";
import type { ReactNode } from "react";

interface SectionShellProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function SectionShell({
  title,
  description,
  children,
}: SectionShellProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1">
        <h2 className="text-[1.75rem] leading-9 font-bold tracking-tight">{title}</h2>
        {description && <InfoTip text={description} />}
      </div>
      <div className="space-y-7">{children}</div>
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
          {title && <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>}
          {/* With a title, the explanation goes behind the "i" so the header stays one line. */}
          {description && (title ? <InfoTip text={description} /> : <p className="text-sm text-muted-foreground">{description}</p>)}
          {aside && <span className="ms-auto">{aside}</span>}
        </div>
      )}
      <div className="rounded-2xl bg-card px-4 py-3">{children}</div>
    </section>
  );
}

/** iOS row: label + short hint at the start, the control at the end. Rows in one card get hairlines from <SettingList>. */
export function SettingRow({ label, hint, htmlFor, labelId, children }: { label: ReactNode; hint?: ReactNode; htmlFor?: string; labelId?: string; children?: ReactNode }) {
  const Label = htmlFor ? "label" : "span";
  return (
    <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1 basis-44">
        <Label htmlFor={htmlFor} id={labelId} className="block font-medium">{label}</Label>
        {hint && <span className="block text-footnote text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export function SettingList({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-border">{children}</div>;
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
