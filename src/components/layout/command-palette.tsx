"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { CalendarCheck, HeartHandshake, Milestone, MessageCircleQuestion, Moon, RefreshCw, Search, Settings2, Sparkles, Sun, Zap, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { usePlan } from "@/hooks/use-plan";
import { cn } from "@/lib/utils";
import { FOOTER_NAV, NAV } from "./app-sidebar";
import { askQuestion } from "@/lib/api";
import { looksLikeQuestion, type AskAnswer } from "@/lib/ask";
import { AskAnswerView } from "@/components/ask/ask-answer";

interface Command {
  id: string;
  label: string;
  hint?: string;
  Icon: React.ComponentType<{ className?: string }>;
  run: () => void;
}

export const OPEN_COMMAND_PALETTE = "spent:open-command-palette";

const SETTINGS = ["general", "appearance", "bank", "ai", "categories", "rules", "data"] as const;

/** Ctrl+K (⌘K on Mac): jump to any page, settings section or common action by typing a few letters. */
export function CommandPalette() {
  const t = useTranslations("palette");
  const tNav = useTranslations("nav");
  const tSettings = useTranslations("settings.sidebar");
  const tRecap = useTranslations("recap");
  const tAsk = useTranslations("ask");
  const tLife = useTranslations("life");
  const tWell = useTranslations("wellbeing");
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();
  const { plan, update } = usePlan();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  // Answer shown inside the palette after choosing "Ask: …"; null while browsing commands.
  const [asked, setAsked] = useState<{ q: string; answer: AskAnswer | null; failed?: boolean } | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if (e.key === "/" && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    const show = () => { setQ(""); setActive(0); setAsked(null); setOpen(true); };
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_COMMAND_PALETTE, show);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_COMMAND_PALETTE, show);
    };
  }, []);

  const commands = useMemo<Command[]>(() => {
    const go = (href: string) => () => router.push(href);
    return [
      ...[...NAV, ...FOOTER_NAV].map((p) => ({ id: p.href, label: tNav(p.labelKey), hint: t("page"), Icon: p.Icon, run: go(p.href) })),
      { id: "checkin", label: t("checkin"), hint: t("action"), Icon: CalendarCheck, run: go("/checkin") },
      { id: "recap", label: tRecap("palette"), hint: t("page"), Icon: Sparkles, run: go("/recap") },
      { id: "ask-page", label: tAsk("title"), hint: t("page"), Icon: MessageCircleQuestion, run: go("/ask") },
      { id: "life", label: tLife("title"), hint: t("page"), Icon: Milestone, run: go("/life") },
      { id: "wellbeing", label: tWell("palette"), hint: t("page"), Icon: HeartHandshake, run: go("/wellbeing") },
      { id: "sync", label: t("sync"), hint: t("action"), Icon: RefreshCw, run: go("/?sync=1") },
      ...SETTINGS.map((s) => ({ id: `settings-${s}`, label: tSettings(s), hint: t("settings"), Icon: Settings2, run: go(`/settings/${s}`) })),
      {
        id: "theme",
        label: resolvedTheme === "dark" ? t("light") : t("dark"),
        hint: t("action"),
        Icon: resolvedTheme === "dark" ? Sun : Moon,
        run: () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
      },
      { id: "simple", label: plan.simpleMode ? t("simpleOff") : t("simpleOn"), hint: t("action"), Icon: Zap, run: () => { void update({ simpleMode: !plan.simpleMode }).catch(() => toast.error(t("saveFailed"))); } },
    ];
  }, [router, t, tNav, tSettings, tRecap, tAsk, tLife, tWell, resolvedTheme, setTheme, plan.simpleMode, update]);

  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const askCommand: Command[] = looksLikeQuestion(q)
    ? [{ id: "ask", label: tAsk("askPrefix", { q: q.trim() }), hint: tAsk("hint"), Icon: MessageCircleQuestion, run: () => {} }]
    : [];
  const results = [...askCommand, ...commands].filter((c) => c.id === "ask" || words.every((w) => `${c.label} ${c.hint ?? ""}`.toLowerCase().includes(w)));
  const current = Math.min(active, Math.max(0, results.length - 1));

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [current, open]);

  function ask(question: string) {
    setAsked({ q: question, answer: null });
    askQuestion(question).then(
      (answer) => setAsked((a) => (a?.q === question ? { q: question, answer } : a)),
      () => setAsked((a) => (a?.q === question ? { q: question, answer: null, failed: true } : a)),
    );
  }

  function choose(c: Command | undefined) {
    if (!c) return;
    if (c.id === "ask") return ask(q.trim());
    setOpen(false);
    setQ("");
    setActive(0);
    c.run();
  }

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setQ(""); setAsked(null); } }}>
      <DialogContent showCloseButton={false} className="top-[12vh] flex max-h-[76dvh] translate-y-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl data-open:animate-none data-closed:animate-none">
        <DialogTitle className="sr-only">{t("title")}</DialogTitle>
        <div className="flex shrink-0 items-center gap-3 border-b border-border px-5">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
              setAsked(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                choose(results[current]);
              }
            }}
            placeholder={t("placeholder")}
            aria-label={t("title")}
            aria-controls="palette-list"
            aria-activedescendant={results[current] ? `palette-${results[current].id}` : undefined}
            role="combobox"
            aria-expanded
            className="h-16 min-w-0 w-full bg-transparent text-[0.9375rem] outline-none placeholder:text-muted-foreground"
          />
          <button type="button" aria-label={t("close")} onClick={() => setOpen(false)} className="grid min-h-11 min-w-11 place-items-center rounded-lg hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"><X className="size-4" aria-hidden /></button>
        </div>
        {asked ? (
          <div className="order-1 min-h-0 max-h-[min(28rem,60dvh)] overflow-y-auto overscroll-contain p-5">
            {asked.answer ? <AskAnswerView answer={asked.answer} onExample={(e) => { setQ(e); ask(e); }} onNavigate={() => setOpen(false)} />
              : asked.failed ? <p role="alert" className="text-footnote text-destructive">{tAsk("error")}</p>
              : <p role="status" className="text-footnote text-muted-foreground">{tAsk("loading")}</p>}
          </div>
        ) : (
        <>
        <p role="status" className="sr-only">{t("count", { n: results.length })}</p>
        <ul id="palette-list" ref={listRef} role="listbox" className="order-1 min-h-0 max-h-[min(24rem,55dvh)] overflow-y-auto overscroll-contain p-1.5">
          {results.length === 0 && <li className="px-3 py-6 text-center text-footnote text-muted-foreground">{t("none")}</li>}
          {results.map((c, i) => (
            <li
              key={c.id}
              id={`palette-${c.id}`}
              role="option"
              aria-selected={i === current}
              onMouseMove={() => setActive(i)}
              onClick={() => choose(c)}
              className={cn("flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-footnote", i === current && "bg-accent")}
            >
              <c.Icon className="size-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate font-medium">{c.label}</span>
              {c.hint && <span className="text-caption text-muted-foreground">{c.hint}</span>}
            </li>
          ))}
        </ul>
        </>
        )}
        <p className="order-3 shrink-0 border-t border-border px-5 py-2 text-caption text-muted-foreground">{t("footer")}</p>
      </DialogContent>
    </Dialog>
    </>
  );
}
