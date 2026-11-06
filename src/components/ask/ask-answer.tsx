"use client";

import { Forward } from "@/components/ui/dir-chevron";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { AskAnswer } from "@/lib/ask";

/** Sentence first, then the key numbers, then up to 5 supporting rows. */
export function AskAnswerView({ answer, onExample, onNavigate }: { answer: AskAnswer; onExample?: (q: string) => void; onNavigate?: () => void }) {
  const t = useTranslations("ask");
  return (
    <div className="flex flex-col gap-3" aria-live="polite">
      {answer.source === "ai" && <p className="w-fit rounded-full bg-accent px-2.5 py-0.5 text-caption font-medium text-muted-foreground">{t("aiLabel")}</p>}
      <p className="text-[0.9375rem] font-semibold leading-snug">{answer.sentence}</p>
      {answer.period && <p className="text-footnote text-muted-foreground">{answer.period}</p>}
      {answer.numbers.length > 0 && (
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {answer.numbers.map((n) => (
            <div key={n.label} className="rounded-xl bg-muted/60 px-3 py-2">
              <dt className="text-caption text-muted-foreground">{n.label}</dt>
              <dd className="text-[0.9375rem] font-semibold tabular-nums">{n.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {answer.rows.length > 0 && (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {answer.rows.map((r, i) => (
            <li key={i} className="flex items-center gap-3 px-3 py-2 text-footnote">
              <span dir="ltr" className="shrink-0 text-caption text-muted-foreground tabular-nums">{r.date}</span>
              <span className="min-w-0 flex-1 truncate">{r.label}</span>
              <span className="shrink-0 font-medium tabular-nums">{r.amount}</span>
            </li>
          ))}
        </ul>
      )}
      {answer.examples && onExample && <ExampleChips examples={answer.examples} onPick={onExample} />}
      {answer.link && (
        <Link href={answer.link.href} onClick={onNavigate} className="inline-flex min-h-11 w-fit items-center gap-1 rounded-lg text-footnote font-medium text-primary focus-visible:outline-2 focus-visible:outline-ring">
          {answer.link.label}
          <Forward />
        </Link>
      )}
    </div>
  );
}

export function ExampleChips({ examples, onPick }: { examples: string[]; onPick: (q: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {examples.map((e) => (
        <button key={e} type="button" onClick={() => onPick(e)} className="min-h-9 rounded-full border border-border bg-popover px-3 py-1.5 text-footnote hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring">
          {e}
        </button>
      ))}
    </div>
  );
}
