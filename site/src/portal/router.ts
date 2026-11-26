import { useSyncExternalStore, type MouseEvent } from "react";

/**
 * Console URLs: /console/<org slug>/<page>[/<id>[/<tab>]]?task=<id>.
 * The open task drawer lives in the query, so a task link is shareable.
 */

export type RouteName =
  | "home" | "inbox" | "notifications" | "my-tasks" | "favorites" | "search"
  | "overview" | "projects" | "project" | "tasks" | "calendar" | "timeline"
  | "members" | "member" | "teams" | "team" | "activity" | "archive" | "settings"
  | "login" | "pick" | "404";

export interface Route {
  name: RouteName;
  org: string | null;
  id?: string;
  tab?: string;
  task: string | null;
  query: URLSearchParams;
}

const PAGES: Record<string, RouteName> = {
  "": "home", inbox: "inbox", notifications: "notifications", "my-tasks": "my-tasks",
  favorites: "favorites", search: "search", overview: "overview", projects: "projects",
  tasks: "tasks", calendar: "calendar", timeline: "timeline", members: "members",
  teams: "teams", activity: "activity", archive: "archive", settings: "settings",
};
/** Pages whose second segment is an id. */
const DETAIL: Record<string, RouteName> = { projects: "project", members: "member", teams: "team" };

export function parse(pathname: string, search: string): Route {
  const query = new URLSearchParams(search);
  const task = query.get("task");
  const [, root, org, page = "", id, tab] = pathname.replace(/\/+$/, "").split("/");
  if (root !== "console") return { name: "404", org: null, task, query };
  if (!org) return { name: "pick", org: null, task, query };
  if (org === "login") return { name: "login", org: null, task, query };
  if (id && page === "settings") return { name: "settings", org, tab: id, task, query };
  if (id && DETAIL[page]) return { name: DETAIL[page], org, id, tab, task, query };
  const name = PAGES[page];
  return name && !id ? { name, org, task, query } : { name: "404", org, task, query };
}

let current = parse(location.pathname, location.search);
const listeners = new Set<() => void>();
const emit = () => {
  current = parse(location.pathname, location.search);
  listeners.forEach((l) => l());
};
window.addEventListener("popstate", emit);

export function navigate(to: string, { replace = false } = {}) {
  if (to === location.pathname + location.search) return;
  history[replace ? "replaceState" : "pushState"](null, "", to);
  emit();
  if (!replace) document.getElementById("main-content")?.scrollTo({ top: 0 });
}

export const useRoute = () =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => current,
  );

export const getRoute = () => current;

/** `/console/<org>/<path>`, keeping nothing else. */
export const to = (org: string, path = "") => `/console/${org}${path ? `/${path.replace(/^\//, "")}` : ""}`;

/** Same page, with the task drawer open on `taskId` (or closed for null). */
export function withTask(taskId: string | null) {
  const q = new URLSearchParams(location.search);
  if (taskId) q.set("task", taskId);
  else q.delete("task");
  const s = q.toString();
  return location.pathname + (s ? `?${s}` : "");
}

/** onClick for <a href>: client-side navigation, but let modified clicks open tabs. */
export function linkClick(e: MouseEvent<HTMLAnchorElement>) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const href = e.currentTarget.getAttribute("href");
  if (!href?.startsWith("/console")) return;
  e.preventDefault();
  navigate(href);
}
