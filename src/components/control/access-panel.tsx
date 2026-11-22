"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAccess, accessAction, listWorkspaces } from "@/lib/api";
import { setActiveWorkspaceId } from "@/lib/workspace-store";
export function AccessPanel() {
  const tr = useTranslations("access"),
    qc = useQueryClient();
  const q = useQuery({ queryKey: ["access"], queryFn: getAccess }),
    workspaces = useQuery({
      queryKey: ["workspaces"],
      queryFn: listWorkspaces,
      enabled: !!q.data?.user,
    });
  const [name, setName] = useState(""),
    [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [ack, setAck] = useState(false);
  async function submit(body: Record<string, unknown>, reload = false) {
    setBusy(true);
    try {
      await accessAction(body);
      setPassword("");
      setName("");
      setUsername("");
      await qc.invalidateQueries();
      if (reload) {
        setActiveWorkspaceId(null);
        window.location.assign("/");
      } else toast.success(tr("saved"));
    } catch {
      toast.error(tr("couldNotCompleteCheck"));
    } finally {
      setBusy(false);
    }
  }
  if (q.isPending) return <p>{tr("loading")}</p>;
  if (q.isError) return <Button onClick={() => void q.refetch()}>{tr("retry")}</Button>;
  const data = q.data,
    isSetup = !data.enabled,
    isLogin = data.enabled && !data.user,
    canCreate = isSetup || data.user?.isAdmin;
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">
        {isLogin ? tr("signIn") : tr("peoplePermissionsAndDevices")}
      </h1>
      {!isLogin && <p className="text-muted-foreground">{tr("permissionsApplyToA")}</p>}
      {isSetup && <p className="rounded-2xl bg-muted p-4">{tr("creatingTheFirstUser")}</p>}
      {(canCreate || isLogin) && (
        <form
          className="space-y-4 rounded-3xl border bg-card p-6"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(
              {
                action: isSetup ? "bootstrap" : isLogin ? "login" : "create-user",
                name,
                username,
                password,
              },
              isSetup || isLogin,
            );
          }}
        >
          {!isLogin && (
            <label className="grid gap-2 text-sm">
              {tr("displayName")}
              <Input
                required
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          )}
          <label className="grid gap-2 text-sm">
            {tr("usernameLatinLettersAnd")}
            <Input
              required
              minLength={3}
              maxLength={50}
              pattern="[a-zA-Z0-9_.-]+"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>
          <label className="grid gap-2 text-sm">
            {tr("passwordAtLeast12")}
            <Input
              required
              type="password"
              minLength={isLogin ? 1 : 12}
              maxLength={200}
              autoComplete={isLogin ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {isSetup && (
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                required
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
              />
              {tr("iHaveSavedMy")}
            </label>
          )}
          <Button disabled={busy || (isSetup && !ack)}>
            {isSetup
              ? tr("createOwnerAndEnable")
              : isLogin
                ? tr("signIn2")
                : tr("createAnotherUser")}
          </Button>
        </form>
      )}
      {data.user && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p>
            {tr("signedInAs")}
            {data.user.name}
          </p>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void submit({ action: "logout" }, true)}
          >
            {tr("signOut")}
          </Button>
        </div>
      )}
      {data.user?.isAdmin && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">{tr("workspaceAccess")}</h2>
          {data.users
            .filter((u) => !u.isAdmin)
            .map((u) => (
              <div key={u.id} className="rounded-2xl border bg-card p-5">
                <h3 className="font-semibold">
                  {u.name} · {u.username}
                </h3>
                <div className="mt-4 space-y-3">
                  {workspaces.data?.map((ws) => (
                    <label
                      key={ws.id}
                      className="flex flex-wrap items-center justify-between gap-3 text-sm"
                    >
                      {ws.name}
                      <select
                        disabled={busy}
                        className="min-h-11 rounded-lg border bg-background px-3"
                        value={
                          data.members.find((m) => m.userId === u.id && m.workspaceId === ws.id)
                            ?.role ?? "none"
                        }
                        onChange={(e) =>
                          void submit({
                            action: "membership",
                            userId: u.id,
                            workspaceId: ws.id,
                            role: e.target.value,
                          })
                        }
                      >
                        <option value="none">{tr("noAccess")}</option>
                        <option value="viewer">{tr("viewer")}</option>
                        <option value="editor">{tr("editor")}</option>
                      </select>
                    </label>
                  ))}
                </div>
                <Button
                  className="mt-3"
                  disabled={busy}
                  variant="ghost"
                  onClick={() => void submit({ action: "revoke-sessions", userId: u.id })}
                >
                  {tr("signOutThisUser")}
                </Button>
              </div>
            ))}
        </section>
      )}
      <section className="rounded-2xl bg-muted p-5">
        <h2 className="font-semibold">{tr("usingAnotherDevice")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{tr("preferencesAreStoredOn")}</p>
      </section>
      {data.audit.length > 0 && (
        <details>
          <summary className="min-h-11 cursor-pointer py-3">{tr("accessHistory")}</summary>
          <ul className="divide-y text-sm">
            {data.audit.map((a) => (
              <li key={a.id} className="py-3">
                {a.createdAt} · {a.name} · {a.action}
              </li>
            ))}
          </ul>
        </details>
      )}
      {!isLogin && (
        <Link href="/control" className="inline-block min-h-11 py-3 text-primary underline">
          {tr("backToFinancialControl")}
        </Link>
      )}
    </div>
  );
}
