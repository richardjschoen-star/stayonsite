import { SettingsCard, SettingsRow } from "@/components/application/settings/settings-rows";
import { ThemeToggle } from "@/components/application/theme/theme-toggle";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Switch } from "@/components/base/switch/switch";
import { cx } from "@/utils/cx";
import { RiAddLine, RiBillLine, RiComputerLine, RiDeleteBinLine, RiDownload2Line, RiEditLine, RiLogoutBoxRLine } from "@remixicon/react";
import { useEffect, useState } from "react";
import { api, authClient, fileUrl } from "../api";
import { INVOICE_STATUS, PCOLORS, ROLE_NAMES } from "../constants";
import { confirm, invoiceModal } from "../overlays/modals";
import { navigate, to, useRoute } from "../router";
import { forceRefresh, isAdmin, personOf, projectOf, reloadOrgs, save, toast, useSnap } from "../store";
import type { Invoice, Snapshot } from "../types";
import { Card, Empty, PageHeader, PersonAvatar, fmtDay, fmtMoney, timeAgo, tint } from "../ui";
import { SHORTCUTS } from "../overlays/modals";
import { Kbd } from "@/components/base/kbd/kbd";

const SECTIONS = [
  ["profile", "Profile"],
  ["appearance", "Appearance"],
  ["notifications", "Notifications"],
  ["security", "Security"],
  ["workspace", "Workspace"],
  ["billing", "Billing"],
] as const;

export function Settings() {
  const s = useSnap();
  const route = useRoute();
  const sections = SECTIONS.filter(([k]) => k !== "billing" || isAdmin(s));
  const sec = sections.find(([k]) => k === route.tab)?.[0] ?? "profile";
  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-6 px-4 sm:px-8 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label="Settings" className="flex gap-1 overflow-x-auto lg:flex-col">
          {sections.map(([k, label]) => (
            <a key={k} href={to(s.org.slug, `settings/${k}`)} aria-current={sec === k ? "page" : undefined} onClick={(e) => (e.preventDefault(), navigate(to(s.org.slug, `settings/${k}`)))} className={cx("shrink-0 rounded-xl px-3 py-2 text-body-medium", sec === k ? "bg-background-secondary-hover text-text-primary" : "text-text-secondary hover:text-text-primary")}>
              {label}
            </a>
          ))}
        </nav>
        <div className="flex min-w-0 max-w-3xl flex-col gap-5">
          {sec === "profile" && <Profile s={s} />}
          {sec === "appearance" && <Appearance />}
          {sec === "notifications" && <NotificationSettings s={s} />}
          {sec === "security" && <Security />}
          {sec === "workspace" && <Workspace s={s} />}
          {sec === "billing" && <Billing s={s} />}
        </div>
      </div>
    </>
  );
}

function Profile({ s }: { s: Snapshot }) {
  const me = personOf(s, s.viewer.id)!;
  const [f, setF] = useState({ name: me.name, title: me.title ?? "", tz: me.tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone });
  const [busy, setBusy] = useState(false);
  const dirty = f.name !== me.name || f.title !== (me.title ?? "") || f.tz !== (me.tz ?? "");
  const submit = async () => {
    if (!f.name.trim()) return;
    setBusy(true);
    const { error } = await authClient.updateUser({ name: f.name.trim(), title: f.title.trim() || null, tz: f.tz } as never);
    setBusy(false);
    if (error) return toast(error.message ?? "Couldn't save", { tone: "error" });
    toast("Profile saved", { tone: "success" });
    await forceRefresh();
  };
  return (
    <form onSubmit={(e) => (e.preventDefault(), submit())}>
      <Card title="Profile">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <PersonAvatar person={{ ...me, name: f.name || me.name }} size="lg" className="size-14 text-title-3-medium" />
            <div className="flex flex-col">
              <span className="text-body-medium text-text-primary">{me.email}</span>
              <span className="text-caption-1-medium text-text-tertiary">{s.viewer.staff ? "StayonSite team" : ROLE_NAMES[s.viewer.role ?? "member"]} · your email can't be changed here</span>
            </div>
          </div>
          <Input label="Name" value={f.name} onChange={(name) => setF({ ...f, name })} />
          <Input label="Title" value={f.title} onChange={(title) => setF({ ...f, title })} placeholder="e.g. Head of Operations" />
          <Input label="Time zone" value={f.tz} onChange={(tz) => setF({ ...f, tz })} hint="Shown on your profile so people know when you're around." />
          <div className="flex justify-end">
            <Button type="submit" disabled={!dirty || busy}>
              Save profile
            </Button>
          </div>
        </div>
      </Card>
    </form>
  );
}

function Appearance() {
  const [compact, setCompact] = useState(() => document.documentElement.classList.contains("compact"));
  return (
    <>
      <SettingsCard>
        <SettingsRow label="Theme" description="Dark is the default; your choice is kept on this device.">
          <ThemeToggle appearance="segmented" size="small" />
        </SettingsRow>
        <SettingsRow label="Reduce motion" description="Follows your system setting.">
          <span className="text-body-2-medium text-text-secondary">{matchMedia("(prefers-reduced-motion: reduce)").matches ? "On" : "Off"}</span>
        </SettingsRow>
        <SettingsRow label="Collapse the sidebar" description="Also with the [ key.">
          <Switch
            size="sm"
            isSelected={compact}
            aria-label="Collapse the sidebar"
            onChange={(v) => {
              setCompact(v);
              localStorage.setItem("console:collapsed", v ? "1" : "0");
              toast("Applied the next time the console loads");
            }}
          />
        </SettingsRow>
      </SettingsCard>
      <Card title="Keyboard shortcuts">
        <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2">
          {SHORTCUTS.map(([what, keys]) => (
            <div key={what} className="contents">
              <dt className="text-body-regular text-text-secondary">{what}</dt>
              <dd className="flex justify-end gap-1">
                {keys.map((k) => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </Card>
    </>
  );
}

function NotificationSettings({ s }: { s: Snapshot }) {
  const admin = s.viewer.staff || s.viewer.role === "owner" || s.viewer.role === "admin";
  return (
    <SettingsCard>
      <SettingsRow label="In the console" description="Mentions, replies, assignments and status changes appear in your Inbox and Notifications.">
        <span className="text-body-2-medium text-text-secondary">Always on</span>
      </SettingsRow>
      <SettingsRow label="Sign-in codes and invites" description="Sent by email, because that's how you get in.">
        <span className="text-body-2-medium text-text-secondary">Email</span>
      </SettingsRow>
      <SettingsRow label="Sign-off requests" description={admin ? "When a step needs your signature, approval or acceptance." : "Sent to your workspace's owners and admins."}>
        <span className="text-body-2-medium text-text-secondary">{admin ? "Email" : "Not you"}</span>
      </SettingsRow>
      <SettingsRow label="Invoices" description={admin ? "When StayonSite sends an invoice." : "Sent to owners and admins."}>
        <span className="text-body-2-medium text-text-secondary">{admin ? "Email" : "Not you"}</span>
      </SettingsRow>
      {s.viewer.staff && (
        <SettingsRow label="Client decisions" description="When a client signs off or asks for changes on a step you own or lead.">
          <span className="text-body-2-medium text-text-secondary">Email</span>
        </SettingsRow>
      )}
    </SettingsCard>
  );
}

interface SessionRow {
  id: string;
  token: string;
  createdAt: string;
  expiresAt: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

function Security() {
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [accounts, setAccounts] = useState<{ id: string; providerId: string; createdAt: string }[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [providers, setProviders] = useState<Record<string, boolean>>({});
  const load = async () => {
    const [ss, aa, me] = await Promise.all([authClient.listSessions(), authClient.listAccounts(), authClient.getSession()]);
    setSessions((ss.data as SessionRow[] | null) ?? []);
    setAccounts((aa.data as { id: string; providerId: string; createdAt: string }[] | null) ?? []);
    setCurrent(me.data?.session.token ?? null);
  };
  useEffect(() => {
    void load();
    fetch("/api/providers").then((r) => r.json()).then(setProviders).catch(() => {});
  }, []);
  const device = (ua?: string | null) => (!ua ? "Unknown device" : /iPhone|iPad/.test(ua) ? "iPhone or iPad" : /Android/.test(ua) ? "Android" : /Mac OS/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Browser");
  const browser = (ua?: string | null) => (!ua ? "" : /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "");
  const linked = new Set(accounts.map((a) => a.providerId));
  return (
    <>
      <Card title="Signed-in devices" actions={sessions && sessions.length > 1 && <Button size="small" variant="ghost" leadingIcon={RiLogoutBoxRLine} onClick={async () => { await authClient.revokeOtherSessions(); toast("Signed out everywhere else"); void load(); }}>Sign out others</Button>}>
        {!sessions ? (
          <p className="text-body-regular text-text-tertiary">Loading…</p>
        ) : (
          <ul className="flex flex-col">
            {sessions.map((x) => (
              <li key={x.id} className="flex items-center gap-3 border-b border-separator-border py-3 last:border-b-0">
                <RiComputerLine className="size-5 text-foreground-icon-secondary" aria-hidden />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-body-medium text-text-primary">
                    {device(x.userAgent)} {browser(x.userAgent) && `· ${browser(x.userAgent)}`}
                    {x.token === current && <span className="ms-2 text-caption-1-medium text-status-lime-text">This device</span>}
                  </span>
                  <span className="text-caption-1-medium text-text-tertiary">
                    {x.ipAddress ?? "Unknown IP"} · signed in {timeAgo(Date.parse(x.createdAt))}
                  </span>
                </span>
                {x.token !== current && (
                  <Button size="small" variant="ghost" onClick={async () => { await authClient.revokeSession({ token: x.token }); void load(); }}>
                    Sign out
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Sign-in methods">
        <ul className="flex flex-col">
          <li className="flex items-center justify-between border-b border-separator-border py-3">
            <span className="flex flex-col">
              <span className="text-body-medium text-text-primary">Email code</span>
              <span className="text-caption-1-medium text-text-tertiary">Always available: we email you a 6-digit code.</span>
            </span>
            <span className="text-body-2-medium text-text-secondary">On</span>
          </li>
          {(["google", "microsoft"] as const).filter((p) => providers[p]).map((p) => (
            <li key={p} className="flex items-center justify-between border-b border-separator-border py-3 last:border-b-0">
              <span className="flex flex-col">
                <span className="text-body-medium text-text-primary capitalize">{p}</span>
                <span className="text-caption-1-medium text-text-tertiary">{linked.has(p) ? `Connected ${timeAgo(Date.parse(accounts.find((a) => a.providerId === p)!.createdAt))}` : "Sign in with your company account."}</span>
              </span>
              {linked.has(p) ? (
                <Button size="small" variant="ghost" onClick={async () => { const r = await authClient.unlinkAccount({ accountId: accounts.find((a) => a.providerId === p)!.id }); if (r.error) toast(r.error.message ?? "Couldn't disconnect", { tone: "error" }); void load(); }}>
                  Disconnect
                </Button>
              ) : (
                <Button size="small" variant="secondary" onClick={() => authClient.linkSocial({ provider: p, callbackURL: location.pathname })}>
                  Connect
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

function Workspace({ s }: { s: Snapshot }) {
  const canRename = s.viewer.staff || s.viewer.role === "owner";
  const [name, setName] = useState(s.org.name);
  const [color, setColor] = useState(s.org.color);
  const submit = async () => {
    try {
      await api("PATCH", `org/${s.org.id}`, { name: name.trim(), color });
      await reloadOrgs();
      await forceRefresh();
      toast("Workspace saved", { tone: "success" });
    } catch (e) {
      toast((e as Error).message, { tone: "error" });
    }
  };
  const destroy = () =>
    confirm({ title: `Delete ${s.org.name}?`, body: "Every project, task, file, sign-off and invoice in it is deleted for everyone, including the files in storage. This can't be undone.", action: "Delete workspace", danger: true }).then(async (ok) => {
      if (!ok) return;
      await api("DELETE", `org/${s.org.id}`).catch((e) => toast(e.message, { tone: "error" }));
      await reloadOrgs();
      location.href = "/console";
    });
  return (
    <>
      <form onSubmit={(e) => (e.preventDefault(), submit())}>
        <Card title="Workspace">
          <div className="flex flex-col gap-4">
            <Input label="Name" value={name} onChange={setName} isDisabled={!canRename} />
            <div className="flex flex-col gap-1.5">
              <span className="text-body-medium text-text-primary">Colour</span>
              <div role="radiogroup" aria-label="Colour" className="flex gap-1.5">
                {Object.keys(PCOLORS).map((c) => (
                  <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={c} disabled={!canRename} onClick={() => setColor(c as typeof color)} style={tint(c)} className="size-6 rounded-full bg-[var(--c)] ring-offset-2 ring-offset-background-primary-default aria-checked:ring-2 aria-checked:ring-border-button-active" />
                ))}
              </div>
            </div>
            <p className="text-caption-1-medium text-text-tertiary">Address: stayon.site/console/{s.org.slug}</p>
            {canRename && (
              <div className="flex justify-end">
                <Button type="submit" disabled={!name.trim() || (name === s.org.name && color === s.org.color)}>
                  Save
                </Button>
              </div>
            )}
          </div>
        </Card>
      </form>
      <SettingsCard>
        <SettingsRow label="Members" description={`${s.people.filter((p) => !p.staff).length} people, ${s.invites.length} pending invites.`}>
          <Button size="small" variant="secondary" onClick={() => navigate(to(s.org.slug, "members"))}>
            Manage
          </Button>
        </SettingsRow>
        <SettingsRow label="Teams" description={`${s.teams.length} teams.`}>
          <Button size="small" variant="secondary" onClick={() => navigate(to(s.org.slug, "members?tab=teams"))}>
            Manage
          </Button>
        </SettingsRow>
      </SettingsCard>
      {s.viewer.staff && (
        <Card title="Danger zone">
          <div className="flex items-center justify-between gap-4">
            <p className="text-body-regular text-text-secondary">Delete this client workspace and everything in it.</p>
            <Button variant="danger" leadingIcon={RiDeleteBinLine} onClick={destroy}>
              Delete workspace
            </Button>
          </div>
        </Card>
      )}
    </>
  );
}

const STATUS_TONE: Record<Invoice["status"] | "overdue", string> = {
  draft: "bg-background-tertiary-default text-text-secondary",
  sent: "bg-status-blue-background text-status-blue-text",
  overdue: "bg-status-rose-background text-status-rose-text",
  paid: "bg-status-lime-background text-status-lime-text",
  void: "bg-background-tertiary-default text-text-tertiary line-through",
};

function Billing({ s }: { s: Snapshot }) {
  const today = new Date().toLocaleDateString("en-CA");
  const status = (i: Invoice) => (i.status === "sent" && i.due && i.due < today ? "overdue" : i.status);
  const outstanding = s.invoices.filter((i) => i.status === "sent");
  const byCurrency = outstanding.reduce<Record<string, number>>((m, i) => ((m[i.currency] = (m[i.currency] ?? 0) + i.amount_cents), m), {});
  return (
    <>
      <Card
        title="Invoices"
        actions={
          s.viewer.staff && (
            <Button size="small" leadingIcon={RiAddLine} onClick={() => invoiceModal()}>
              New invoice
            </Button>
          )
        }
      >
        {Object.keys(byCurrency).length > 0 && (
          <p className="mb-4 text-body-regular text-text-secondary">
            Outstanding: <span className="text-body-semibold text-text-primary">{Object.entries(byCurrency).map(([c, v]) => fmtMoney(v, c)).join(" + ")}</span> across {outstanding.length} invoice{outstanding.length === 1 ? "" : "s"}.
          </p>
        )}
        {!s.invoices.length ? (
          <Empty icon={RiBillLine} title="No invoices yet" body={s.viewer.staff ? "Create one and attach the PDF; the client's owners and admins are emailed when it's sent." : "Invoices from StayonSite appear here when they're sent."} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="text-caption-1-semibold text-text-tertiary">
                  {["Invoice", "Project", "Issued", "Due", "Amount", "Status", ""].map((h) => (
                    <th key={h} className="px-2 py-2 text-start font-[inherit]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {s.invoices.map((i) => {
                  const st = status(i);
                  return (
                    <tr key={i.id} className="border-t border-separator-border">
                      <td className="px-2 py-2.5 text-body-medium text-text-primary">
                        {i.number}
                        {i.note && <span className="block text-caption-1-medium text-text-tertiary">{i.note}</span>}
                      </td>
                      <td className="px-2 text-body-2-medium text-text-secondary">{projectOf(s, i.project_id)?.name ?? "—"}</td>
                      <td className="px-2 text-body-2-medium text-text-secondary">{i.issued ? fmtDay(i.issued) : "—"}</td>
                      <td className="px-2 text-body-2-medium text-text-secondary">{i.due ? fmtDay(i.due) : "—"}</td>
                      <td className="px-2 text-body-medium text-text-primary tabular-nums">{fmtMoney(i.amount_cents, i.currency)}</td>
                      <td className="px-2">
                        <span className={cx("rounded-md px-1.5 py-0.5 text-caption-1-medium", STATUS_TONE[st])}>{st === "overdue" ? "Overdue" : INVOICE_STATUS[i.status]}</span>
                      </td>
                      <td className="px-2">
                        <span className="flex justify-end gap-1">
                          {i.file_id && (
                            <a href={fileUrl(i.file_id, true)} aria-label={`Download ${i.number}`} className="rounded-lg p-1.5 text-foreground-icon-secondary hover:bg-background-secondary-hover">
                              <RiDownload2Line className="size-4" aria-hidden />
                            </a>
                          )}
                          {s.viewer.staff && (
                            <>
                              {i.status === "sent" && (
                                <Button size="xs" variant="secondary" onClick={() => save("invoice", i.id, { status: "paid" })}>
                                  Mark paid
                                </Button>
                              )}
                              {i.status === "draft" && (
                                <Button size="xs" onClick={() => save("invoice", i.id, { status: "sent" })}>
                                  Send
                                </Button>
                              )}
                              <button aria-label={`Edit ${i.number}`} onClick={() => invoiceModal(i)} className="rounded-lg p-1.5 text-foreground-icon-secondary hover:bg-background-secondary-hover">
                                <RiEditLine className="size-4" aria-hidden />
                              </button>
                            </>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="text-caption-1-medium text-text-tertiary">Payment is by bank transfer as shown on each invoice. Questions about billing: hello@stayon.site.</p>
    </>
  );
}
