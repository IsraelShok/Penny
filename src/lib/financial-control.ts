import { monthDay } from "./balance-forecast";
export type Commitment = { id: number; name: string; amount: number; nextDate: string; cadence: "once"|"monthly"|"yearly"; source: "bank"|"card"; status: "active"|"cancelled"; trialEnd: string|null; seriesKey: string|null; previousAmount: number|null };
export function commitmentDates(item: Pick<Commitment,"nextDate"|"cadence"|"status">, from: string, to: string) {
  if (item.status !== "active") return [];
  const [y,m,d]=item.nextDate.split("-").map(Number); const out:string[]=[];
  for(let i=0;i<1200;i++) {
    const date=monthDay(y,m-1+i*(item.cadence==="yearly"?12:1),d);
    if(date>to) break;
    if(date>=from) out.push(date);
    if(item.cadence==="once") break;
  }
  return out;
}
export function validDay(value: unknown): value is string {
  return typeof value==="string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value+"T12:00:00Z").toISOString().slice(0,10)===value;
}
export type QualityFinding = { key:string; severity:"review"|"missing"; title:string; detail:string; href:string; count:number };
export type GoalLink = { transactionId:number; goalId:number; contribution:number; description:string; date:string };
export type GoalRule = { id:number; goalId:number; account:string; description:string; direction:number; fromDate:string; enabled:number; automatic?:number; transactionSign?:number };
export type ChangeDriver = {categoryId:number;name:string;current:number;previous:number;delta:number};
export type ControlPayload = {
 participants:{id:number;name:string}[]; tasks:{transactionId:number;userId:number;name:string;description:string;done:number}[];
 commitments:Commitment[]; links:GoalLink[]; rules:GoalRule[]; reserve:number;
 quality:QualityFinding[]; drivers:ChangeDriver[]; month:string; previousMonth:string;
 audit:{id:number;action:string;createdAt:string;actorName?:string|null}[];
};
