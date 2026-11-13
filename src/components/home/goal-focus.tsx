"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getPlan, savePlanItem } from "@/lib/api";
import { useActiveWorkspaceId } from "@/lib/workspace-store";
import { isoWeek } from "@/lib/plan";
import { shekels } from "@/lib/money";
import { CardShell, CardError, CardSkeleton } from "./card-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Goal } from "@/lib/types";

export function GoalFocus() {
  const locale = useLocale(); const he = locale === "he"; const title = he ? "צעד קטן, יעד גדול" : "Small steps, meaningful goals";
  const q = useQuery({ queryKey: ["plan"], queryFn: getPlan }); const qc = useQueryClient();
  const workspaceId = useActiveWorkspaceId();
  const focusKey = `penny.goal-focus.${workspaceId ?? "default"}`;
  const [selected, setSelected] = useState<number | null>(null);
  const [draft, setDraft] = useState<Partial<Goal> | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { try { setSelected(Number(localStorage.getItem(focusKey)) || null); } catch { setSelected(null); } setDraft(null); }, [focusKey]);
  if (q.isPending) return <CardSkeleton label={title} />;
  if (q.isError) return <CardError label={title} />;
  const goal = q.data.goals.find(g => g.id === selected) ?? q.data.goals[0];
  const pct = goal ? Math.min(100, Math.max(0, goal.savedAmount / goal.targetAmount * 100)) : 0;
  const reviewed = q.data.plan.checkin.lastWeek === isoWeek(new Date());
  async function save() {
    if (!draft) return;
    setBusy(true);
    try { await savePlanItem("goal", draft); await qc.invalidateQueries({ queryKey: ["plan"] }); setDraft(null); toast.success(he ? "היעד נשמר" : "Goal saved"); }
    catch { toast.error(he ? "השמירה נכשלה. אפשר לנסות שוב." : "Could not save. Try again."); }
    finally { setBusy(false); }
  }
  return <CardShell label={title}>
    {draft ? <form className="space-y-3" onSubmit={e => { e.preventDefault(); void save(); }}>
      <label className="block space-y-1 text-sm">{he ? "בשביל מה חוסכים?" : "What are you saving for?"}<Input required maxLength={60} value={draft.name ?? ""} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
      <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-sm">{he ? "סכום היעד ₪" : "Target ₪"}<Input required type="number" min="0.01" step="0.01" value={draft.targetAmount ?? ""} onChange={e => setDraft({ ...draft, targetAmount: Number(e.target.value) })} /></label><label className="space-y-1 text-sm">{he ? "יתרת חיסכון התחלתית ₪" : "Opening savings ₪"}<Input required type="number" min="0" step="0.01" value={draft.savedAmount ?? 0} onChange={e => setDraft({ ...draft, savedAmount: Number(e.target.value) })} /></label></div>
      <label className="block space-y-1 text-sm">{he ? "חודש היעד" : "Target month"}<Input required type="month" value={draft.targetDate ?? ""} onChange={e => setDraft({ ...draft, targetDate: e.target.value })} /></label>
      <p className="text-xs text-muted-foreground">{he ? "זו יתרת הפתיחה. העברות שקושרו ליעד נוספות אליה אוטומטית. אין כאן העברת כסף." : "Savings are self-reported; this does not transfer money or change your bank balance."}</p>
      <div className="flex gap-2"><Button disabled={busy} type="submit">{he ? "שמירה" : "Save"}</Button><Button disabled={busy} variant="ghost" type="button" onClick={() => setDraft(null)}>{he ? "ביטול" : "Cancel"}</Button></div>
    </form> : <>
      {goal ? <><label className="block text-sm">{he ? "היעד שאני מתמקד בו" : "My focus"}<select className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3" value={goal.id} onChange={e => { setSelected(Number(e.target.value)); try { localStorage.setItem(focusKey, e.target.value); } catch { toast.error(he ? "לא ניתן לשמור את הבחירה בדפדפן" : "Could not save your focus in this browser"); } }}>{q.data.goals.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label><p className="mt-4 text-3xl font-semibold"><bdi>{shekels(goal.savedAmount, locale)}</bdi><span className="ms-2 text-sm font-normal text-muted-foreground">{he ? "מתוך" : "of"} {shekels(goal.targetAmount, locale)}</span></p><progress aria-label={goal.name} value={pct} max={100} className="mt-4 h-3 w-full accent-primary" /><div className="mt-2 flex justify-between text-xs">{[25, 50, 75, 100].map(n => <span key={n} className={pct >= n ? "font-semibold text-primary" : "text-muted-foreground"}>{pct >= n ? "✓ " : ""}{n}%</span>)}</div><p className="mt-3 text-sm text-muted-foreground">{pct >= 100 ? (he ? "הגעת ליעד שבחרת. אפשר לבחור את הצעד הבא." : "You reached your goal. Choose your next step.") : (he ? "כל התקדמות נחשבת. אפשר לשנות את היעד בכל רגע." : "Every step counts. You can adjust your goal anytime.")}</p><Button className="mt-3" variant="outline" onClick={() => setDraft({ ...goal, savedAmount: goal.openingSavedAmount ?? goal.savedAmount })}>{he ? "עדכון ההתקדמות" : "Update progress"}</Button></> : <p className="text-muted-foreground">{he ? "בחרו משהו שחשוב לכם — קרן חירום, חופשה או התחלה חדשה." : "Choose something meaningful: an emergency fund, a trip or a fresh start."}</p>}
      <Button className="mt-3 ms-2" variant="ghost" onClick={() => setDraft({ name: "", savedAmount: 0, targetDate: new Date().toISOString().slice(0, 7) })}>{he ? "יעד חדש" : "New goal"}</Button>
      <Link href="/checkin" className="mt-5 block rounded-2xl bg-muted p-4 text-sm"><strong>{reviewed ? (he ? "✓ הסקירה השבועית הושלמה" : "✓ Weekly review complete") : (he ? "הצעד השבועי: סקירה קצרה" : "This week: a quick review")}</strong><span className="mt-1 block text-muted-foreground">{he ? "כמה דקות להבין מה השתנה ולבחור צעד אחד. אפשר לחזור בכל זמן." : "A few minutes to understand what changed and choose one action. Come back anytime."}</span></Link>
    </>}
  </CardShell>;
}
