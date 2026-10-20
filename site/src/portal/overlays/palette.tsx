import { applyThemeWithTransition } from "@/components/application/theme/theme-toggle";
import { Kbd } from "@/components/base/kbd/kbd";
import { cx } from "@/utils/cx";
import {
  RiAddLine, RiArrowLeftRightLine, RiArrowRightLine, RiCalendarLine, RiChat3Line, RiCheckboxCircleLine,
  RiFolderLine, RiHome5Line, RiInboxLine, RiKeyboardLine, RiLogoutBoxRLine, RiMoonLine, RiSearchLine,
  RiSettings3Line, RiSideBarLine, RiTeamLine, RiTimeLine, RiUserAddLine, RiBuilding2Line,
} from "@remixicon/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { navigate, to, withTask } from "../router";
import { getState, isAdmin, liveTasks, openProjects, personOf, taskKey } from "../store";
import type { Snapshot } from "../types";
import { FileIcon, PersonAvatar, ProjectIcon, StatusIcon, type IconType } from "../ui";
import { makeStore, useExternal } from "./layer";
import { clientModal, filePreview, inviteModal, newTask, projectModal, shortcutsModal } from "./modals";

type Mode = "cmd" | "search" | "ws";
const state = makeStore<Mode | null>(null);
export const openPalette = (mode: Mode = "cmd") => state.set(mode);
export const closePalette = () => state.set(null);
export const paletteOpen = () => state.get() !== null;

interface Row {
  key: string;
  label: string;
  sub?: string;
  icon: ReactNode;
  kbd?: string;
  run: () => void;
}

const icon = (I: IconType) => <I className="size-4 shrink-0 text-foreground-icon-secondary" aria-hidden />;
const plain = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

/** Workspace search, shared by the palette and the Search page. */
export function searchAll(s: Snapshot, q: string) {
  const ql = q.trim().toLowerCase();
  const has = (t: string | null | undefined) => !!t && t.toLowerCase().includes(ql);
  if (!ql) return { tasks: [], projects: [], people: [], files: [], comments: [] };
  return {
    tasks: liveTasks(s).filter((t) => has(t.title) || has(taskKey(s, t)) || has(plain(t.description))),
    projects: openProjects(s).filter((p) => has(p.name) || has(plain(p.description)) || has(p.key)),
    people: s.people.filter((p) => has(p.name) || has(p.email) || has(p.title)),
    files: s.files.filter((f) => has(f.name)),
    comments: s.comments.filter((c) => has(plain(c.body))),
  };
}

function rows(s: Snapshot, mode: Mode, q: string): { group: string; items: Row[] }[] {
  const go = (path: string) => () => navigate(to(s.org.slug, path));
  const ql = q.trim().toLowerCase();
  if (mode === "ws") {
    return [{ group: "Switch workspace", items: getState().orgs.filter((o) => !ql || o.name.toLowerCase().includes(ql)).map((o) => ({ key: o.id, label: o.name, sub: o.id === s.org.id ? "Current" : undefined, icon: icon(RiBuilding2Line), run: () => navigate(to(o.slug)) })) }];
  }
  if (mode === "search" || ql) {
    const r = searchAll(s, q);
    const groups: { group: string; items: Row[] }[] = [
      { group: "Tasks", items: r.tasks.slice(0, 6).map((t) => ({ key: t.id, label: t.title, sub: taskKey(s, t), icon: <StatusIcon status={t.status} />, run: () => navigate(to(s.org.slug, `projects/${t.project_id}`) + `?task=${t.id}`) })) },
      { group: "Projects", items: r.projects.slice(0, 4).map((p) => ({ key: p.id, label: p.name, icon: <ProjectIcon p={p} size="sm" />, run: go(`projects/${p.id}`) })) },
      { group: "People", items: r.people.slice(0, 4).map((p) => ({ key: p.id, label: p.name, sub: p.email, icon: <PersonAvatar person={p} size="xs" />, run: go(`members/${p.id}`) })) },
      { group: "Files", items: r.files.slice(0, 4).map((f) => ({ key: f.id, label: f.name, icon: <FileIcon type={f.type} name={f.name} className="size-4" />, run: () => filePreview(f, s) })) },
      { group: "Comments", items: r.comments.slice(0, 3).map((c) => ({ key: c.id, label: plain(c.body).slice(0, 80), sub: personOf(s, c.author_id)?.name, icon: icon(RiChat3Line), run: () => (c.task_id ? navigate(withTask(c.task_id)) : go(`projects/${c.project_id}/${c.stage_id ? "process" : "overview"}`)()) })) },
    ].filter((g) => g.items.length);
    if (mode === "cmd") groups.push({ group: "Commands", items: commands(s).filter((c) => c.label.toLowerCase().includes(ql)) });
    if (ql) groups.push({ group: "", items: [{ key: "all", label: `See all results for “${q.trim()}”`, icon: icon(RiSearchLine), run: () => navigate(to(s.org.slug, `search?q=${encodeURIComponent(q.trim())}`)) }] });
    return groups;
  }
  const mine = liveTasks(s).filter((t) => t.assignee_id === s.viewer.id && t.status !== "done").sort((a, b) => b.updated_at - a.updated_at).slice(0, 4);
  return [
    { group: "Suggestions", items: commands(s).slice(0, 3) },
    ...(mine.length ? [{ group: "Your recent tasks", items: mine.map((t) => ({ key: t.id, label: t.title, sub: taskKey(s, t), icon: <StatusIcon status={t.status} />, run: () => navigate(to(s.org.slug, `projects/${t.project_id}`) + `?task=${t.id}`) })) }] : []),
    { group: "Commands", items: commands(s).slice(3) },
  ];
}

function commands(s: Snapshot): Row[] {
  const go = (path: string) => () => navigate(to(s.org.slug, path));
  const dark = document.documentElement.classList.contains("dark");
  return [
    { key: "task", label: "Create task", icon: icon(RiAddLine), kbd: "N", run: () => newTask() },
    ...(isAdmin(s) ? [{ key: "project", label: "Create project", icon: icon(RiFolderLine), kbd: "P", run: () => projectModal() }] : []),
    { key: "search", label: "Search workspace", icon: icon(RiSearchLine), kbd: "/", run: () => setTimeout(() => openPalette("search")) },
    { key: "home", label: "Go to Home", icon: icon(RiHome5Line), kbd: "G H", run: go("") },
    { key: "inbox", label: "Go to Inbox", icon: icon(RiInboxLine), kbd: "G I", run: go("inbox") },
    { key: "my", label: "Go to My Tasks", icon: icon(RiCheckboxCircleLine), kbd: "G T", run: go("my-tasks") },
    { key: "projects", label: "Go to Projects", icon: icon(RiFolderLine), kbd: "G P", run: go("projects") },
    { key: "cal", label: "Go to Calendar", icon: icon(RiCalendarLine), kbd: "G C", run: go("calendar") },
    { key: "tl", label: "Go to Timeline", icon: icon(RiTimeLine), run: go("timeline") },
    { key: "mem", label: "Go to Members", icon: icon(RiTeamLine), kbd: "G M", run: go("members") },
    { key: "set", label: "Open settings", icon: icon(RiSettings3Line), kbd: "G S", run: go("settings") },
    ...(getState().orgs.length > 1 ? [{ key: "ws", label: "Switch workspace…", icon: icon(RiArrowLeftRightLine), run: () => setTimeout(() => openPalette("ws")) }] : []),
    { key: "dark", label: dark ? "Switch to light mode" : "Switch to dark mode", icon: icon(RiMoonLine), kbd: "⌘ ⇧ L", run: () => void applyThemeWithTransition(dark ? "light" : "dark") },
    ...(isAdmin(s) ? [{ key: "invite", label: "Invite people", icon: icon(RiUserAddLine), run: () => inviteModal() }] : []),
    ...(s.viewer.staff ? [{ key: "client", label: "Add a client", icon: icon(RiBuilding2Line), run: clientModal }] : []),
    { key: "side", label: "Toggle sidebar", icon: icon(RiSideBarLine), kbd: "[", run: () => dispatchEvent(new KeyboardEvent("keydown", { key: "[" })) },
    { key: "keys", label: "Keyboard shortcuts", icon: icon(RiKeyboardLine), kbd: "?", run: shortcutsModal },
    { key: "out", label: "Sign out", icon: icon(RiLogoutBoxRLine), run: () => import("../shell").then((m) => m.signOut()) },
  ];
}

/** ⌘K: commands by default, Tab flips to search; on the native <dialog> like the marketing site's. */
export function Palette() {
  const mode = useExternal(state);
  const s = getState().snap;
  const [q, setQ] = useState("");
  const [hl, setHl] = useState(0);
  const ref = useRef<HTMLDialogElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const d = ref.current!;
    if (mode && !d.open) d.showModal();
    if (!mode && d.open) d.close();
    setQ("");
    setHl(0);
  }, [mode]);

  const groups = s && mode ? rows(s, mode, q) : [];
  const flat = groups.flatMap((g) => g.items);
  const run = (r: Row | undefined) => {
    if (!r) return;
    closePalette();
    r.run();
  };
  useEffect(() => {
    list.current?.querySelector(`[data-i="${hl}"]`)?.scrollIntoView({ block: "nearest" });
  }, [hl]);

  let i = -1;
  return (
    <dialog
      ref={ref}
      aria-label="Search and commands"
      onClose={closePalette}
      onClick={(e) => e.target === ref.current && closePalette()}
      className="pop-dialog m-auto mt-[12vh] w-[min(620px,calc(100vw-2rem))] rounded-3xl border border-border-button-default bg-background-primary-default p-2 text-text-primary shadow-xl backdrop:bg-black/60"
    >
      <div className="flex items-center gap-2 rounded-2xl bg-background-secondary-default px-3 py-2.5">
        <RiSearchLine className="size-5 text-foreground-icon-tertiary" aria-hidden />
        <input
          autoFocus
          value={q}
          onChange={(e) => (setQ(e.target.value), setHl(0))}
          placeholder={mode === "search" ? "Search tasks, projects, people, files…" : mode === "ws" ? "Switch to…" : "Type a command or search…"}
          aria-label="Search and commands"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setHl((h) => (h + (e.key === "ArrowDown" ? 1 : -1) + flat.length) % Math.max(flat.length, 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              run(flat[hl]);
            } else if (e.key === "Tab") {
              e.preventDefault();
              state.set(mode === "search" ? "cmd" : "search");
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-body-medium text-text-primary outline-none placeholder:text-text-placeholder"
        />
        <Kbd>Tab</Kbd>
        <span className="text-caption-1-medium text-text-tertiary">{mode === "search" ? "commands" : "search"}</span>
      </div>
      <div ref={list} role="listbox" aria-label="Results" className="mt-2 flex max-h-[min(60vh,480px)] flex-col overflow-y-auto">
        {groups.map((g) => (
          <div key={g.group || "more"} className="flex flex-col pb-1">
            {g.group && <p className="px-3 pt-2 pb-1 text-caption-1-semibold text-text-tertiary">{g.group}</p>}
            {g.items.map((r) => {
              i++;
              const n = i;
              return (
                <button
                  key={`${g.group}-${r.key}`}
                  data-i={n}
                  role="option"
                  aria-selected={hl === n}
                  onMouseMove={() => setHl(n)}
                  onClick={() => run(r)}
                  className={cx("flex items-center gap-2.5 rounded-xl px-3 py-2 text-start outline-none", hl === n && "bg-background-secondary-hover")}
                >
                  {r.icon}
                  <span className="min-w-0 flex-1 truncate text-body-medium text-text-primary">{r.label}</span>
                  {r.sub && <span className="max-w-[40%] truncate text-caption-1-medium text-text-tertiary">{r.sub}</span>}
                  {r.kbd && <Kbd>{r.kbd}</Kbd>}
                  {hl === n && !r.kbd && <RiArrowRightLine className="size-4 text-foreground-icon-tertiary" aria-hidden />}
                </button>
              );
            })}
          </div>
        ))}
        {!flat.length && <p className="px-3 py-6 text-center text-body-regular text-text-tertiary">Nothing matches “{q}”.</p>}
      </div>
    </dialog>
  );
}
