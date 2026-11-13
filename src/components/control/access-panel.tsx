"use client";
import {useState} from "react";
import Link from "next/link";
import {useQuery,useQueryClient} from "@tanstack/react-query";
import {useLocale} from "next-intl";
import {toast} from "sonner";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {getAccess,accessAction,listWorkspaces} from "@/lib/api";
import {setActiveWorkspaceId} from "@/lib/workspace-store";
export function AccessPanel(){
 const he=useLocale()==="he",tr=(a:string,b:string)=>he?a:b,qc=useQueryClient();
 const q=useQuery({queryKey:["access"],queryFn:getAccess}),workspaces=useQuery({queryKey:["workspaces"],queryFn:listWorkspaces,enabled:!!q.data?.user});
 const [name,setName]=useState(""),[username,setUsername]=useState(""),[password,setPassword]=useState(""),[busy,setBusy]=useState(false),[ack,setAck]=useState(false);
 async function submit(body:Record<string,unknown>,reload=false){setBusy(true);try{await accessAction(body);setPassword("");setName("");setUsername("");await qc.invalidateQueries();if(reload){setActiveWorkspaceId(null);window.location.assign("/");}else toast.success(tr("נשמר","Saved"));}catch{toast.error(tr("הפעולה לא הושלמה. בדקו את הפרטים, או נסו שוב מאוחר יותר.","Could not complete. Check details or try again later."));}finally{setBusy(false);}}
 if(q.isPending)return <p>{tr("טוענים…","Loading…")}</p>;
 if(q.isError)return <Button onClick={()=>void q.refetch()}>{tr("ניסיון נוסף","Retry")}</Button>;
 const data=q.data,isSetup=!data.enabled,isLogin=data.enabled&&!data.user,canCreate=isSetup||data.user?.isAdmin;
 return <div className="space-y-6"><h1 className="text-3xl font-semibold">{isLogin?tr("כניסה למרחב שלי","Sign in"):tr("משתמשים, הרשאות ומכשירים","People, permissions and devices")}</h1>
  {!isLogin&&<p className="text-muted-foreground">{tr("ההרשאות הן לכל סביבת עבודה. שמרו חשבונות פרטיים בסביבה נפרדת, ושתפו רק את הסביבה המשפחתית. חבר עם הרשאת צפייה אינו יכול לערוך נתונים; חבר עורך יכול לעדכן תקציבים, יעדים ותנועות.","Permissions apply to a workspace. Keep private accounts in a separate workspace and share only the household workspace. Viewers cannot edit financial data; editors can update budgets, goals and transactions.")}</p>}
  {isSetup&&<p className="rounded-2xl bg-muted p-4">{tr("יצירת המשתמש הראשון מפעילה דרישת כניסה למוצר. המשתמש הראשון יהיה בעלים עם גישה לכל הסביבות הקיימות. שמרו את פרטי הכניסה — לא קיימת כאן התאוששות באמצעות דוא״ל.","Creating the first user enables sign-in for the app. The first user owns all existing workspaces. Keep the credentials safe; email recovery is not configured.")}</p>}
  {(canCreate||isLogin)&&<form className="space-y-4 rounded-3xl border bg-card p-6" onSubmit={e=>{e.preventDefault();void submit({action:isSetup?"bootstrap":isLogin?"login":"create-user",name,username,password},isSetup||isLogin);}}>
   {!isLogin&&<label className="grid gap-2 text-sm">{tr("שם לתצוגה","Display name")}<Input required maxLength={60} value={name} onChange={e=>setName(e.target.value)}/></label>}
   <label className="grid gap-2 text-sm">{tr("שם משתמש (אותיות לטיניות ומספרים)","Username (Latin letters and numbers)")}<Input required minLength={3} maxLength={50} pattern="[a-zA-Z0-9_.-]+" autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)}/></label>
   <label className="grid gap-2 text-sm">{tr("סיסמה (לפחות 12 תווים)","Password (at least 12 characters)")}<Input required type="password" minLength={isLogin?1:12} maxLength={200} autoComplete={isLogin?"current-password":"new-password"} value={password} onChange={e=>setPassword(e.target.value)}/></label>
   {isSetup&&<label className="flex items-start gap-3 text-sm"><input type="checkbox" required checked={ack} onChange={e=>setAck(e.target.checked)}/>{tr("שמרתי את פרטי הכניסה ואני רוצה להפעיל כניסה לפי משתמש.","I have saved my credentials and want to enable user sign-in.")}</label>}
   <Button disabled={busy||isSetup&&!ack}>{isSetup?tr("יצירת בעלים והפעלת כניסה","Create owner and enable sign-in"):isLogin?tr("כניסה","Sign in"):tr("יצירת משתמש נוסף","Create another user")}</Button>
  </form>}
  {data.user&&<div className="flex flex-wrap items-center justify-between gap-3"><p>{tr("מחוברים בתור ","Signed in as ")}{data.user.name}</p><Button variant="outline" disabled={busy} onClick={()=>void submit({action:"logout"},true)}>{tr("יציאה","Sign out")}</Button></div>}
  {data.user?.isAdmin&&<section className="space-y-4"><h2 className="text-xl font-semibold">{tr("גישה לסביבות עבודה","Workspace access")}</h2>{data.users.filter(u=>!u.isAdmin).map(u=><div key={u.id} className="rounded-2xl border bg-card p-5"><h3 className="font-semibold">{u.name} · {u.username}</h3><div className="mt-4 space-y-3">{workspaces.data?.map(ws=><label key={ws.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">{ws.name}<select disabled={busy} className="min-h-11 rounded-lg border bg-background px-3" value={data.members.find(m=>m.userId===u.id&&m.workspaceId===ws.id)?.role??"none"} onChange={e=>void submit({action:"membership",userId:u.id,workspaceId:ws.id,role:e.target.value})}><option value="none">{tr("ללא גישה","No access")}</option><option value="viewer">{tr("צפייה","Viewer")}</option><option value="editor">{tr("עריכה","Editor")}</option></select></label>)}</div><Button className="mt-3" disabled={busy} variant="ghost" onClick={()=>void submit({action:"revoke-sessions",userId:u.id})}>{tr("ניתוק המכשירים של המשתמש","Sign out this user's devices")}</Button></div>)}</section>}
  <section className="rounded-2xl bg-muted p-5"><h2 className="font-semibold">{tr("שימוש ממכשיר נוסף","Using another device")}</h2><p className="mt-2 text-sm text-muted-foreground">{tr("ההעדפות נשמרות בשרת לפי משתמש וסביבת עבודה. התחברו לאותו שרת כדי לקבל אותן במכשיר אחר. כרגע השרת מקומי ב־127.0.0.1; כתובת זו בטלפון מתייחסת לטלפון עצמו. לא נפתחה גישה לרשת כחלק מהשינוי. אפשר להעביר את המערכת לשרת ביתי עם HTTPS וכתובת מורשית כשלב פריסה נפרד.","Preferences are stored on the server by user and workspace. Sign in to the same server from another device. This instance currently runs on 127.0.0.1, which on a phone refers to the phone itself. Network access has not been opened. A home-server deployment with HTTPS and an allowed hostname is a separate deployment step.")}</p></section>
  {data.audit.length>0&&<details><summary className="min-h-11 cursor-pointer py-3">{tr("היסטוריית הרשאות","Access history")}</summary><ul className="divide-y text-sm">{data.audit.map(a=><li key={a.id} className="py-3">{a.createdAt} · {a.name} · {a.action}</li>)}</ul></details>}
  {!isLogin&&<Link href="/control" className="inline-block min-h-11 py-3 text-primary underline">{tr("חזרה למרכז הכסף","Back to financial control")}</Link>}
 </div>;
}
