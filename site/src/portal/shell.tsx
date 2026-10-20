import { Collapsible, NavItem } from "@/components/application/dashboard/dashboard-sidebar";
import { DashboardTeamMenu, type MenuGroup } from "@/components/application/dashboard/dashboard-team-menu";
import { DashboardUserMenu } from "@/components/application/dashboard/dashboard-user-menu";
import { Badge } from "@/components/base/badges/badge";
import { Breadcrumb, BreadcrumbItem } from "@/components/base/breadcrumb/breadcrumb";
import { Button } from "@/components/base/buttons/button";
import { IconButton } from "@/components/base/buttons/icon-button";
import { Dropdown, DropdownDivider, DropdownItem, DropdownPopover, DropdownTrigger } from "@/components/base/dropdown/dropdown";
import { Kbd } from "@/components/base/kbd/kbd";
import { cx } from "@/utils/cx";
import {
  RiAddLine, RiArchiveLine, RiArrowDownSLine, RiArrowRightSLine, RiBillLine, RiBuilding2Line, RiCalendarLine,
  RiCheckboxCircleLine, RiCloseLine, RiDashboardLine, RiFlowChart, RiFolderLine, RiHome5Line, RiInboxLine,
  RiKanbanView, RiListCheck3, RiLock2Line, RiLogoutBoxRLine, RiMenuLine, RiMoreFill, RiNotification3Line,
  RiPulseLine, RiQuestionLine, RiSearchLine, RiSettings3Line, RiSideBarLine, RiStarLine, RiTeamLine,
  RiTimeLine, RiUserAddLine, RiUserLine, RiAttachment2, RiCalendarEventLine, RiFolderChartLine,
} from "@remixicon/react";
import { useEffect, useState, type ReactNode } from "react";
import { authClient } from "./api";
import { ROLE_NAMES } from "./constants";
import { useKeys } from "./keys";
import { ContextMenuHost, ModalHost, Sheet, openContextMenu, openModal } from "./overlays/layer";
import { TaskDrawer } from "./overlays/drawer";
import { clientModal, eventModal, inviteModal, invoiceModal, newTask, projectModal, shortcutsModal } from "./overlays/modals";
import { Palette, openPalette } from "./overlays/palette";
import { projectMenu } from "./pages/projects";
import { PAGES, PAGE_NAMES } from "./pages";
import { navigate, to, useRoute, type Route } from "./router";
import { isAdmin, isFav, isOver, liveTasks, openOrg, openProjects, personOf, projectOf, useStore } from "./store";
import type { OrgRef, Snapshot } from "./types";
import { Empty, PersonAvatar, ProjectIcon, Toasts, initials } from "./ui";
import { PSTAT } from "./constants";

/** Everything inside /console/<org>: loads the workspace, then draws the frame. */
export function Shell() {
  const route = useRoute();
  const { orgs, snap, loadError, me } = useStore();
  const org = orgs.find((o) => o.slug === route.org);

  useEffect(() => {
    if (!org) return;
    void openOrg(org.id);
    localStorage.setItem("console:org", org.slug);
  }, [org?.id]);

  if (!org)
    return (
      <Centered>
        <Empty
          icon={RiLock2Line}
          title="You don't have access to this workspace"
          body={orgs.length ? "It may have been removed, or you haven't been invited." : me?.staff ? "There are no clients yet." : "Ask your StayonSite contact to invite you."}
          action={
            orgs[0] ? (
              <Button onClick={() => navigate(to(orgs[0].slug))}>Go to {orgs[0].name}</Button>
            ) : me?.staff ? (
              <Button leadingIcon={RiAddLine} onClick={clientModal}>
                Add your first client
              </Button>
            ) : (
              <Button variant="secondary" onClick={signOut}>
                Sign out
              </Button>
            )
          }
        />
        <ModalHost />
        <Toasts />
      </Centered>
    );
  if (loadError) return <Centered><Empty icon={RiLock2Line} title={loadError} action={<Button onClick={() => location.reload()}>Try again</Button>} /></Centered>;
  if (!snap || snap.org.id !== org.id) return <Loading />;
  return <Frame snap={snap} route={route} orgs={orgs} />;
}

export const signOut = () => authClient.signOut().then(() => (location.href = "/console/login"));

function Centered({ children }: { children: ReactNode }) {
  return <main className="flex min-h-dvh flex-col items-center justify-center bg-background-full p-6">{children}</main>;
}

function Loading() {
  return (
    <div className="flex h-dvh gap-3 bg-background-full p-3" aria-busy="true" aria-label="Loading the console">
      <div className="hidden w-[260px] animate-pulse rounded-3xl bg-background-secondary-default lg:block" />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="h-7 w-48 animate-pulse rounded-lg bg-background-secondary-default" />
        <div className="h-4 w-80 animate-pulse rounded bg-background-secondary-default" />
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-3xl bg-background-secondary-default" />
          ))}
        </div>
      </div>
    </div>
  );
}

function Frame({ snap: s, route, orgs }: { snap: Snapshot; route: Route; orgs: OrgRef[] }) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("console:collapsed") === "1");
  const [mobileNav, setMobileNav] = useState(false);
  const toggle = () => setCollapsed((c) => (localStorage.setItem("console:collapsed", c ? "0" : "1"), !c));
  useKeys({ toggleSidebar: toggle });
  useEffect(() => setMobileNav(false), [route]);

  const Page = PAGES[route.name] ?? PAGES["404"]!;
  return (
    <div className="flex h-dvh overflow-hidden bg-background-full text-text-primary">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-[80] focus:rounded-lg focus:bg-background-primary-default focus:px-3 focus:py-2">
        Skip to content
      </a>
      <div className="hidden py-3 ps-3 lg:flex">
        <Sidebar s={s} route={route} orgs={orgs} collapsed={collapsed} onToggle={toggle} />
      </div>
      {mobileNav && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileNav(false)} aria-hidden />
          <div className="relative p-2">
            <Sidebar s={s} route={route} orgs={orgs} collapsed={false} onToggle={() => setMobileNav(false)} mobile />
          </div>
        </div>
      )}
      <main className="flex min-w-0 flex-1 flex-col">
        <Topbar s={s} route={route} onMenu={() => setMobileNav(true)} />
        <div id="main-content" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto pb-24 outline-none lg:pb-10">
          <Page />
        </div>
      </main>
      <BottomNav s={s} route={route} onMore={() => setMobileNav(true)} />
      <TaskDrawer />
      <Palette />
      <ModalHost />
      <ContextMenuHost />
      <Toasts />
    </div>
  );
}

/* ------------------------------------------------------------- sidebar --- */

const myDue = (s: Snapshot) => liveTasks(s).filter((t) => t.assignee_id === s.viewer.id && t.status !== "done" && t.due && (isOver(t) || t.due <= new Date().toLocaleDateString("en-CA"))).length;
const unreadInbox = (s: Snapshot) => s.notifs.filter((n) => !n.read && n.type !== "update").length;

function Sidebar({ s, route, orgs, collapsed, onToggle, mobile = false }: { s: Snapshot; route: Route; orgs: OrgRef[]; collapsed: boolean; onToggle: () => void; mobile?: boolean }) {
  const [open, setOpen] = useState<Record<string, boolean>>(() => JSON.parse(localStorage.getItem("console:expanded") ?? "{}"));
  const expand = (id: string) => setOpen((o) => {
    const next = { ...o, [id]: !o[id] };
    localStorage.setItem("console:expanded", JSON.stringify(next));
    return next;
  });
  const go = (path: string) => () => navigate(to(s.org.slug, path));
  const item = (key: string, label: string, icon: typeof RiHome5Line, path: string, count?: number) => (
    <NavItem
      key={key}
      icon={icon}
      label={label}
      href={to(s.org.slug, path)}
      onClick={go(path)}
      collapsed={collapsed}
      isSelected={route.name === key}
      badge={count ? <Badge color={route.name === key ? "primary" : "neutral"}>{count}</Badge> : undefined}
    />
  );
  const projects = openProjects(s).filter((p) => p.status !== "complete");
  const archived = s.tasks.filter((t) => t.archived).length + s.projects.filter((p) => !p.locked && p.archived).length;
  const me = personOf(s, s.viewer.id);
  const current = orgs.find((o) => o.id === s.org.id)!;

  const account: MenuGroup[] = [
    {
      id: "personal",
      items: [
        { icon: RiUserLine, label: "Profile", onSelect: go("settings/profile") },
        { icon: RiNotification3Line, label: "Notifications", onSelect: go("notifications"), badge: s.notifs.filter((n) => !n.read).length ? String(s.notifs.filter((n) => !n.read).length) : undefined },
        ...(isAdmin(s) ? [{ icon: RiBillLine, label: "Billing", onSelect: go("settings/billing") }] : []),
      ],
    },
    ...(s.viewer.staff
      ? [{ id: "staff", label: "StayonSite", items: [{ icon: RiBuilding2Line, label: "Add a client", onSelect: clientModal }, { icon: RiUserAddLine, label: "Add team member", onSelect: () => inviteModal(true) }] }]
      : []),
    { id: "out", items: [{ icon: RiLogoutBoxRLine, label: "Sign out", onSelect: () => void signOut() }] },
  ];

  return (
    <aside
      aria-label="Main"
      className={cx(
        "flex h-full shrink-0 flex-col justify-between overflow-hidden rounded-3xl border border-border-button-white bg-background-secondary-default shadow-sidebar transition-[width] duration-300 ease-in-out",
        collapsed ? "w-[60px] px-[11px] py-3" : mobile ? "w-[min(280px,85vw)] p-3" : "w-[260px] p-3",
      )}
    >
      <div className="-m-2 flex min-h-0 w-[calc(100%+16px)] flex-col gap-3 overflow-y-auto p-2 [scrollbar-width:none]">
        <div className={cx("flex w-full", collapsed ? "flex-col-reverse items-start gap-2.5" : "items-center justify-between")}>
          <div className="-m-2 min-w-0 overflow-hidden p-2">
            <DashboardUserMenu
              collapsed={collapsed}
              name={current.name}
              initials={initials(current.name)}
              avatarColor="blue"
              label={s.viewer.staff ? "Clients" : "Workspaces"}
              rows={orgs.map((o) => ({ id: o.slug, name: o.name, initials: initials(o.name), color: "blue" as const, isSelected: o.id === s.org.id }))}
              onPick={(slug) => navigate(to(slug))}
              actions={(close) =>
                s.viewer.staff ? (
                  <Button variant="secondary" size="small" leadingIcon={RiAddLine} className="flex-1" onClick={() => (close(), clientModal())}>
                    Add client
                  </Button>
                ) : isAdmin(s) ? (
                  <Button variant="secondary" size="small" leadingIcon={RiUserAddLine} className="flex-1" onClick={() => (close(), inviteModal())}>
                    Invite people
                  </Button>
                ) : null
              }
            />
          </div>
          <button type="button" onClick={onToggle} aria-label={mobile ? "Close navigation" : collapsed ? "Expand sidebar" : "Collapse sidebar"} title={mobile ? undefined : "Toggle sidebar  ["} className={cx("cursor-pointer text-foreground-icon-secondary", collapsed && "flex w-9 justify-center")}>
            {mobile ? <RiCloseLine className="size-5" aria-hidden /> : <RiSideBarLine className="size-5" aria-hidden />}
          </button>
        </div>

        <button
          type="button"
          onClick={() => openPalette()}
          title={collapsed ? "Search" : undefined}
          aria-label="Search or jump to"
          className={cx("flex cursor-pointer items-center gap-2 rounded-full bg-background-tertiary-default p-2 hover:bg-background-tertiary-hover/55", collapsed ? "w-9" : "w-full")}
        >
          <RiSearchLine className="size-5 shrink-0 text-foreground-icon-secondary" aria-hidden />
          <Collapsible collapsed={collapsed} className="flex-1">
            <span className="text-body-medium whitespace-nowrap text-text-secondary">Search or jump to…</span>
          </Collapsible>
          <Collapsible collapsed={collapsed}>
            <Kbd>⌘K</Kbd>
          </Collapsible>
        </button>

        <nav className={cx("flex w-full flex-col gap-1", !collapsed && "px-0.5")}>
          {item("home", "Home", RiHome5Line, "")}
          {item("inbox", "Inbox", RiInboxLine, "inbox", unreadInbox(s))}
          {item("my-tasks", "My Tasks", RiCheckboxCircleLine, "my-tasks", myDue(s))}
          {item("favorites", "Favorites", RiStarLine, "favorites")}
          {item("notifications", "Notifications", RiNotification3Line, "notifications", s.notifs.filter((n) => !n.read).length)}
        </nav>

        <Group label="Workspace" collapsed={collapsed}>
          {item("overview", "Overview", RiDashboardLine, "overview")}
          {item("projects", "Projects", RiFolderLine, "projects")}
          {item("tasks", "Tasks", RiListCheck3, "tasks")}
          {item("calendar", "Calendar", RiCalendarLine, "calendar")}
          {item("timeline", "Timeline", RiTimeLine, "timeline")}
          {item("members", "Members", RiTeamLine, "members")}
          {item("activity", "Activity", RiPulseLine, "activity")}
        </Group>

        <Group label="Projects" collapsed={collapsed} onAdd={isAdmin(s) ? () => projectModal() : undefined} addLabel="New project">
          {projects.map((p) => {
            const here = route.name === "project" && route.id === p.id;
            const subs: [string, string, typeof RiKanbanView][] = [
              ...(p.template === "engagement" ? [["process", "Process", RiFlowChart] as [string, string, typeof RiKanbanView]] : []),
              ["board", "Board", RiKanbanView],
              ["list", "List", RiListCheck3],
              ["timeline", "Timeline", RiTimeLine],
              ["files", "Files", RiAttachment2],
            ];
            return (
              <div key={p.id} className="group/proj flex flex-col">
                <div className="relative" onContextMenu={(e) => openContextMenu(e, projectMenu(s, p))}>
                  <NavItem
                    icon={RiFolderLine}
                    leading={<ProjectIcon p={p} />}
                    label={p.name}
                    href={to(s.org.slug, `projects/${p.id}`)}
                    onClick={go(`projects/${p.id}`)}
                    collapsed={collapsed}
                    isSelected={here && !route.tab}
                    badge={
                      <span className="flex items-center gap-1">
                        {isFav(s, "project", p.id) && <RiStarLine className="size-3 text-status-yellow-text" aria-hidden />}
                        {p.private && <RiLock2Line className="size-3 text-foreground-icon-tertiary" aria-hidden />}
                        <span className="size-1.5 rounded-full" style={{ background: PSTAT[p.status].c }} title={PSTAT[p.status].name} />
                        <span className="w-9" />
                      </span>
                    }
                  />
                  {!collapsed && (
                    <span className="absolute end-1.5 top-1/2 flex -translate-y-1/2 items-center">
                      <button aria-label="Project options" onClick={(e) => openContextMenu(e, projectMenu(s, p))} className="invisible rounded p-0.5 text-foreground-icon-tertiary group-hover/proj:visible hover:text-text-primary">
                        <RiMoreFill className="size-4" aria-hidden />
                      </button>
                      <button aria-label={open[p.id] ? "Collapse" : "Expand"} aria-expanded={!!open[p.id]} onClick={() => expand(p.id)} className="rounded p-0.5 text-foreground-icon-tertiary hover:text-text-primary">
                        {open[p.id] ? <RiArrowDownSLine className="size-4" aria-hidden /> : <RiArrowRightSLine className="size-4" aria-hidden />}
                      </button>
                    </span>
                  )}
                </div>
                {open[p.id] && !collapsed && (
                  <div className="ms-4 flex flex-col gap-0.5 border-s border-separator-border ps-2 pt-0.5">
                    {subs.map(([tab, label, Icon]) => (
                      <NavItem key={tab} icon={Icon} label={label} href={to(s.org.slug, `projects/${p.id}/${tab}`)} onClick={go(`projects/${p.id}/${tab}`)} isSelected={here && route.tab === tab} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {item("archive", "Archive", RiArchiveLine, "archive", archived)}
        </Group>

        {s.teams.length > 0 || isAdmin(s) ? (
          <Group label="Teams" collapsed={collapsed} onAdd={isAdmin(s) ? () => import("./overlays/modals").then((m) => m.teamModal()) : undefined} addLabel="New team">
            {s.teams.map((t) => (
              <NavItem key={t.id} icon={RiTeamLine} label={t.name} href={to(s.org.slug, `teams/${t.id}`)} onClick={go(`teams/${t.id}`)} collapsed={collapsed} isSelected={route.name === "team" && route.id === t.id} />
            ))}
          </Group>
        ) : null}
      </div>

      <div className="flex w-full shrink-0 flex-col gap-3 pt-3">
        <nav className="flex w-full flex-col gap-1">
          <NavItem icon={RiQuestionLine} label="Help & resources" collapsed={collapsed} onClick={helpModal} />
          {item("settings", "Settings", RiSettings3Line, "settings")}
        </nav>
        <DashboardTeamMenu
          collapsed={collapsed}
          showThemeToggle
          name={me?.name ?? "You"}
          email={me?.email ?? ""}
          avatar={<PersonAvatar person={me} size="md" />}
          groups={account}
          footer={s.viewer.staff ? "StayonSite team" : `${ROLE_NAMES[s.viewer.role ?? "member"]} at ${s.org.name}`}
          version="Console"
        />
      </div>
    </aside>
  );
}

function Group({ label, collapsed, children, onAdd, addLabel }: { label: string; collapsed: boolean; children: ReactNode; onAdd?: () => void; addLabel?: string }) {
  return (
    <div className="flex w-full flex-col gap-1">
      {!collapsed ? (
        <div className="flex items-center justify-between px-2.5 pt-2">
          <span className="text-caption-1-semibold text-text-tertiary">{label}</span>
          {onAdd && (
            <button aria-label={addLabel} title={addLabel} onClick={onAdd} className="rounded p-0.5 text-foreground-icon-tertiary hover:bg-background-secondary-hover hover:text-text-primary">
              <RiAddLine className="size-4" aria-hidden />
            </button>
          )}
        </div>
      ) : (
        <div className="mx-auto my-1 h-px w-6 bg-separator-border" />
      )}
      <nav aria-label={label} className={cx("flex w-full flex-col gap-1", !collapsed && "px-0.5")}>
        {children}
      </nav>
    </div>
  );
}

function helpModal() {
  openModal((close) => (
    <Sheet title="Help & resources" onClose={close}>
      <div className="flex flex-col gap-1">
        {[
          ["Keyboard shortcuts", "Every shortcut in one list.", () => (close(), shortcutsModal())],
          ["How an engagement runs", "The 11 steps from first call to running it together.", () => (close(), (location.href = "/#process"))],
          ["Email your StayonSite team", "hello@stayon.site, usually answered within a working day.", () => (location.href = "mailto:hello@stayon.site")],
          ["Privacy", "How we handle your data.", () => window.open("/privacy/", "_blank")],
        ].map(([title, body, run]) => (
          <button key={title as string} onClick={run as () => void} className="flex flex-col rounded-2xl px-3 py-2.5 text-start hover:bg-background-secondary-hover">
            <span className="text-body-medium text-text-primary">{title as string}</span>
            <span className="text-body-regular text-text-secondary">{body as string}</span>
          </button>
        ))}
      </div>
    </Sheet>
  ));
}

/* -------------------------------------------------------------- topbar --- */

function crumbs(s: Snapshot, r: Route): { label: string; path?: string; icon?: ReactNode }[] {
  if (r.name === "project") {
    const p = projectOf(s, r.id);
    return [{ label: "Projects", path: "projects" }, { label: p?.name ?? "Project", icon: p ? <ProjectIcon p={p} size="sm" /> : undefined }];
  }
  if (r.name === "member") return [{ label: "Members", path: "members" }, { label: personOf(s, r.id)?.name ?? "Member" }];
  if (r.name === "team") return [{ label: "Teams", path: "members?tab=teams" }, { label: s.teams.find((t) => t.id === r.id)?.name ?? "Team" }];
  return [{ label: PAGE_NAMES[r.name] ?? "Not found" }];
}

function Topbar({ s, route, onMenu }: { s: Snapshot; route: Route; onMenu: () => void }) {
  const unread = s.notifs.some((n) => !n.read);
  const [open, setOpen] = useState(false);
  const pick = (fn: () => void) => () => (setOpen(false), fn());
  const list = crumbs(s, route);
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 px-3 sm:px-6">
      <IconButton icon={RiMenuLine} aria-label="Open navigation" onClick={onMenu} className="lg:hidden" />
      <Breadcrumb className="min-w-0 flex-1">
        {list.map((c, i) =>
          i === list.length - 1 ? (
            <BreadcrumbItem key={i} current>
              <span className="flex items-center gap-1.5 text-body-medium text-text-primary">
                {c.icon}
                {c.label}
              </span>
            </BreadcrumbItem>
          ) : (
            <BreadcrumbItem key={i} onClick={() => navigate(to(s.org.slug, c.path))}>
              <span className="text-body-medium">{c.label}</span>
            </BreadcrumbItem>
          ),
        )}
      </Breadcrumb>
      <button
        type="button"
        onClick={() => openPalette()}
        className="hidden h-9 w-60 items-center gap-2 rounded-full bg-background-secondary-default ps-3 pe-1.5 text-body-medium text-text-placeholder outline-none hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring md:flex"
      >
        <RiSearchLine className="size-4 text-foreground-icon-tertiary" aria-hidden />
        Search or jump to…
        <Kbd className="ms-auto">⌘K</Kbd>
      </button>
      <span className="relative">
        <IconButton icon={RiNotification3Line} aria-label={unread ? "Notifications, unread" : "Notifications"} onClick={() => navigate(to(s.org.slug, "notifications"))} />
        {unread && <span className="pointer-events-none absolute end-2 top-2 size-2 rounded-full bg-accent-500 ring-2 ring-background-full" />}
      </span>
      <Dropdown isOpen={open} onOpenChange={setOpen}>
        <DropdownTrigger aria-label="Create new" className="flex h-8 items-center gap-1 rounded-lg border border-border-button-default bg-background-primary-default px-2 text-body-medium text-text-primary shadow-xs hover:bg-background-primary-hover">
          <RiAddLine className="size-[18px]" aria-hidden />
          <span className="hidden sm:inline">New</span>
          <RiArrowDownSLine className="hidden size-4 text-text-secondary sm:block" aria-hidden />
        </DropdownTrigger>
        <DropdownPopover aria-label="Create" placement="bottom end" className="w-60">
          <DropdownItem onSelect={pick(() => newTask(route.name === "project" && route.id ? { project_id: route.id } : {}))}>
            <RiCheckboxCircleLine className="size-5 text-foreground-icon-secondary" aria-hidden />
            <span className="flex-1">Task</span>
            <Kbd>N</Kbd>
          </DropdownItem>
          {isAdmin(s) && (
            <DropdownItem onSelect={pick(() => projectModal())}>
              <RiFolderChartLine className="size-5 text-foreground-icon-secondary" aria-hidden />
              <span className="flex-1">Project</span>
              <Kbd>P</Kbd>
            </DropdownItem>
          )}
          <DropdownItem onSelect={pick(() => eventModal(route.name === "project" && route.id ? { project_id: route.id } : {}))}>
            <RiCalendarEventLine className="size-5 text-foreground-icon-secondary" aria-hidden />
            <span className="flex-1">Event</span>
          </DropdownItem>
          {isAdmin(s) && (
            <>
              <DropdownDivider />
              <DropdownItem onSelect={pick(() => inviteModal())}>
                <RiUserAddLine className="size-5 text-foreground-icon-secondary" aria-hidden />
                <span className="flex-1">Invite people</span>
              </DropdownItem>
            </>
          )}
          {s.viewer.staff && (
            <>
              <DropdownItem onSelect={pick(() => invoiceModal())}>
                <RiBillLine className="size-5 text-foreground-icon-secondary" aria-hidden />
                <span className="flex-1">Invoice</span>
              </DropdownItem>
              <DropdownItem onSelect={pick(clientModal)}>
                <RiBuilding2Line className="size-5 text-foreground-icon-secondary" aria-hidden />
                <span className="flex-1">Client workspace</span>
              </DropdownItem>
            </>
          )}
        </DropdownPopover>
      </Dropdown>
    </header>
  );
}

/* ---------------------------------------------------------- bottom nav --- */

function BottomNav({ s, route, onMore }: { s: Snapshot; route: Route; onMore: () => void }) {
  const tab = (key: string, label: string, Icon: typeof RiHome5Line, path: string, dot = false) => (
    <a
      key={key}
      href={to(s.org.slug, path)}
      onClick={(e) => (e.preventDefault(), navigate(to(s.org.slug, path)))}
      aria-current={route.name === key ? "page" : undefined}
      className={cx("relative flex flex-1 flex-col items-center gap-0.5 py-2 text-caption-2-medium", route.name === key ? "text-text-primary" : "text-text-tertiary")}
    >
      <Icon className="size-5" aria-hidden />
      {label}
      {dot && <span className="absolute end-[calc(50%-14px)] top-1.5 size-2 rounded-full bg-accent-500" />}
    </a>
  );
  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-separator-border bg-background-primary-default/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      {tab("home", "Home", RiHome5Line, "")}
      {tab("my-tasks", "My Tasks", RiCheckboxCircleLine, "my-tasks")}
      {tab("projects", "Projects", RiFolderLine, "projects")}
      {tab("inbox", "Inbox", RiInboxLine, "inbox", unreadInbox(s) > 0)}
      <button onClick={onMore} className="flex flex-1 flex-col items-center gap-0.5 py-2 text-caption-2-medium text-text-tertiary">
        <RiMoreFill className="size-5" aria-hidden />
        More
      </button>
    </nav>
  );
}

