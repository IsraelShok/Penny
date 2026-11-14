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
          {/* Short notes stay inline; longer explanations go behind the "i". */}
          {description && (title && description.length > 60 ? <InfoTip text={description} /> : <p className="text-sm text-muted-foreground">{description}</p>)}
          {aside && <span className="ms-auto">{aside}</span>}
        </div>
      )}
      <div className="rounded-2xl bg-card px-4 py-3">{children}</div>
    </section>
  );
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
