/** A tab's secondary cards, always shown (cards never fold away). */
export function More({ children }: { id: string; children: React.ReactNode }) {
  return <div className="grid gap-4 md:gap-6">{children}</div>;
}
