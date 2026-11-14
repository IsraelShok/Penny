"use client";

import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { askQuestion } from "@/lib/api";
import type { AskAnswer } from "@/lib/ask";
import { AskAnswerView, ExampleChips } from "./ask-answer";

export function AskBox() {
  const t = useTranslations("ask");
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<AskAnswer | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function ask(question: string) {
    if (!question.trim()) return;
    setQ(question);
    setState("loading");
    try {
      setAnswer(await askQuestion(question));
      setState("idle");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <form onSubmit={(e) => { e.preventDefault(); void ask(q); }} className="flex items-center gap-2 rounded-2xl border border-border bg-popover px-4 shadow-sm focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring">
        <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("placeholder")} aria-label={t("title")} className="h-14 min-w-0 flex-1 bg-transparent text-[0.9375rem] outline-none placeholder:text-muted-foreground" />
        <Button type="submit" disabled={state === "loading"}>
          {t("submit")}
        </Button>
      </form>
      <ExampleChips examples={t.raw("examples") as string[]} onPick={(e) => void ask(e)} />
      <div className="rounded-2xl border border-border bg-card p-5">
        {state === "loading" ? <p className="text-footnote text-muted-foreground" role="status">{t("loading")}</p>
          : state === "error" ? <p className="text-footnote text-destructive" role="alert">{t("error")}</p>
          : answer ? <AskAnswerView answer={answer} onExample={(e) => void ask(e)} />
          : <p className="text-footnote text-muted-foreground">{t("empty")}</p>}
      </div>
    </div>
  );
}
