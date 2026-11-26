import type { Perm, Role } from "../../worker/access";
import type { Gate } from "../process";
import type { Priority, ProjectColor, ProjectStatus, Status } from "./constants";

export type { Perm, Role };

export interface Me {
  id: string;
  name: string;
  email: string;
  staff: boolean;
}

export interface OrgRef {
  id: string;
  name: string;
  slug: string;
  color: ProjectColor;
  role: Role | null;
}

export interface Person {
  id: string;
  name: string;
  email: string;
  image: string | null;
  title: string | null;
  tz: string | null;
  /** Role in this org; null for StayonSite staff. */
  role: Role | null;
  staff: boolean;
  joined: number | null;
}

export interface Invite {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  created_at: number;
  expires_at: number;
}

export interface Team {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  lead_id: string | null;
  members: string[];
}

export interface Milestone {
  id: string;
  name: string;
  date: string | null;
}

export interface Project {
  id: string;
  org_id: string;
  key: string;
  name: string;
  icon: string;
  color: ProjectColor;
  status: ProjectStatus;
  team_id: string | null;
  lead_id: string | null;
  start: string | null;
  due: string | null;
  description: string;
  members: Record<string, Perm>;
  milestones: Milestone[];
  private: boolean;
  archived: number;
  ord: number;
  template: string | null;
  created_by: string;
  created_at: number;
  updated_at: number;
  /** The viewer's permission. */
  perm: Perm;
  /** A private project the viewer isn't on: only id/key/name/icon/color are real. */
  locked?: false;
}

export interface LockedProject {
  id: string;
  key: string;
  name: string;
  icon: string;
  color: ProjectColor;
  private: true;
  locked: true;
}

export interface Check {
  id: string;
  text: string;
  done: boolean;
}

export interface Stage {
  id: string;
  project_id: string;
  n: number;
  phase: "sales" | "delivery";
  name: string;
  length: string;
  owner_id: string | null;
  due: string | null;
  status: "todo" | "active" | "done" | "skipped";
  gate: Gate | null;
  decision: "approved" | "rejected" | null;
  decided_by: string | null;
  decided_at: number | null;
  decided_file_id: string | null;
  decided_ip: string | null;
  decision_note: string | null;
  items: Check[];
}

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  project_id: string;
  num: number;
  title: string;
  status: Status;
  priority: Priority;
  assignee_id: string | null;
  start: string | null;
  due: string | null;
  labels: string[];
  deps: string[];
  subtasks: Subtask[];
  description: string;
  estimate: string | null;
  recur: string | null;
  ord: number;
  stage_id: string | null;
  internal: boolean;
  completed_at: number | null;
  archived: number;
  created_by: string;
  created_at: number;
  updated_at: number;
}

export interface Comment {
  id: string;
  project_id: string;
  task_id: string | null;
  stage_id: string | null;
  author_id: string;
  body: string;
  reactions: Record<string, string[]>;
  internal: boolean;
  created_at: number;
  edited_at: number | null;
}

export interface FileRow {
  id: string;
  org_id: string;
  project_id: string | null;
  task_id: string | null;
  stage_id: string | null;
  name: string;
  type: string;
  size: number;
  internal: boolean;
  uploaded_by: string;
  created_at: number;
}

export interface CalEvent {
  id: string;
  project_id: string | null;
  title: string;
  date: string;
  time: string | null;
  created_by: string;
}

export interface Invoice {
  id: string;
  project_id: string | null;
  number: string;
  amount_cents: number;
  currency: string;
  status: "draft" | "sent" | "paid" | "void";
  issued: string | null;
  due: string | null;
  file_id: string | null;
  note: string;
  created_at: number;
}

export interface Activity {
  id: string;
  project_id: string | null;
  task_id: string | null;
  stage_id: string | null;
  actor_id: string;
  verb: string;
  data: { extra?: string };
  internal: boolean;
  at: number;
}

export type NotifType = "mention" | "assign" | "comment" | "update" | "approval" | "invoice";

export interface Notif {
  id: string;
  type: NotifType;
  actor_id: string;
  project_id: string | null;
  task_id: string | null;
  stage_id: string | null;
  text: string;
  snippet: string;
  read: boolean;
  at: number;
}

export interface Filter {
  f: string;
  op: string;
  v: string[];
}

export interface SavedView {
  id: string;
  project_id: string | null;
  user_id: string | null;
  name: string;
  type: "board" | "list" | "table" | "calendar" | "timeline";
  filters: Filter[];
}

export interface Snapshot {
  org: { id: string; name: string; slug: string; color: ProjectColor };
  viewer: { id: string; staff: boolean; role: Role | null };
  people: Person[];
  invites: Invite[];
  teams: Team[];
  projects: (Project | LockedProject)[];
  stages: Stage[];
  tasks: Task[];
  comments: Comment[];
  files: FileRow[];
  events: CalEvent[];
  invoices: Invoice[];
  activity: Activity[];
  notifs: Notif[];
  views: SavedView[];
  favorites: { kind: "project" | "task"; ref_id: string }[];
}
