import type { ComponentType } from "react";
import type { RouteName } from "../router";
import { CalendarPage } from "../views/calendar";
import { TimelinePage } from "../views/timeline";
import { ActivityPage, Home, Overview } from "./home";
import { Inbox, Notifications } from "./inbox";
import { MemberPage, Members, TeamPage } from "./people";
import { ProjectPage } from "./project";
import { Projects } from "./projects";
import { NotFound, Search } from "./search";
import { Settings } from "./settings";
import { Archive, Favorites, MyTasks, Tasks } from "./tasks";

/** Route → page, like gr8r's renderPage table. */
export const PAGES: Partial<Record<RouteName, ComponentType>> = {
  home: Home, inbox: Inbox, notifications: Notifications, "my-tasks": MyTasks, favorites: Favorites,
  search: Search, overview: Overview, projects: Projects, project: ProjectPage, tasks: Tasks,
  calendar: CalendarPage, timeline: TimelinePage, members: Members, member: MemberPage,
  teams: Members, team: TeamPage, activity: ActivityPage, archive: Archive, settings: Settings, "404": NotFound,
};

export const PAGE_NAMES: Partial<Record<RouteName, string>> = {
  home: "Home", inbox: "Inbox", notifications: "Notifications", "my-tasks": "My Tasks", favorites: "Favorites",
  search: "Search", overview: "Overview", projects: "Projects", tasks: "Tasks", calendar: "Calendar",
  timeline: "Timeline", members: "Members", teams: "Teams", activity: "Activity", archive: "Archive", settings: "Settings",
};
