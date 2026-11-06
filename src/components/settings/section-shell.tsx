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
    <div className="space-y-5">
      <div className="flex items-center gap-1">
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        {description && <InfoTip text={description} />}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

interface SettingCardProps {
  title?: string;
  description?: string;
  children: ReactNode;
}

export function SettingCard({
  title,
  description,
  children,
}: SettingCardProps) {
  return (
    <div className="rounded-2xl bg-card p-6">
      {(title || description) && (
        <div className="mb-4 flex items-center gap-1">
          {title && <h3 className="font-medium">{title}</h3>}
          {/* Short notes stay inline; longer explanations go behind the "i". */}
          {description && (title && description.length > 60 ? <InfoTip text={description} /> : <p className="text-sm text-muted-foreground">{description}</p>)}
        </div>
      )}
      {children}
    </div>
  );
}
