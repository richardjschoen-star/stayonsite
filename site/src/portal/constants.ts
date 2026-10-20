/**
 * Console vocabulary, shared by the UI and the Worker (which validates
 * against the same ids). No React here, so the Worker can import it.
 */

export const STATUSES = [
  { id: "backlog", name: "Backlog" },
  { id: "todo", name: "To Do" },
  { id: "progress", name: "In Progress" },
  { id: "review", name: "Review" },
  { id: "done", name: "Done" },
] as const;
export type Status = (typeof STATUSES)[number]["id"];

export const PRIOS = [
  { id: "urgent", name: "Urgent", w: 4 },
  { id: "high", name: "High", w: 3 },
  { id: "medium", name: "Medium", w: 2 },
  { id: "low", name: "Low", w: 1 },
  { id: "none", name: "No priority", w: 0 },
] as const;
export type Priority = (typeof PRIOS)[number]["id"];

export const LABELS = [
  { id: "design", name: "Design", c: "#8662C9" },
  { id: "frontend", name: "Frontend", c: "#3B82C4" },
  { id: "backend", name: "Backend", c: "#23918A" },
  { id: "research", name: "Research", c: "#C48A1E" },
  { id: "content", name: "Content", c: "#C54B78" },
  { id: "bug", name: "Bug", c: "#D14343" },
  { id: "qa", name: "QA", c: "#3D8E5F" },
  { id: "growth", name: "Growth", c: "#D9792B" },
] as const;

export const PSTAT = {
  planning: { name: "Planning", c: "#8A867E" },
  active: { name: "In Progress", c: "#3B82C4" },
  risk: { name: "At Risk", c: "#D14343" },
  hold: { name: "On Hold", c: "#C48A1E" },
  complete: { name: "Completed", c: "#3D8E5F" },
} as const;
export type ProjectStatus = keyof typeof PSTAT;

export const PCOLORS = {
  indigo: "#5A67D8",
  blue: "#3B82C4",
  violet: "#8662C9",
  teal: "#23918A",
  rose: "#C54B78",
  amber: "#C48A1E",
  green: "#3D8E5F",
  slate: "#6B7280",
} as const;
export type ProjectColor = keyof typeof PCOLORS;

/** Icon names; the UI maps them to Remix icons. */
export const PICONS = [
  "globe", "smartphone", "megaphone", "rocket", "component", "building",
  "layout", "palette", "code", "briefcase", "target", "layers", "zap",
  "heart", "folder", "sparkles",
] as const;

export const RECUR_DAYS = { Daily: 1, Weekly: 7, "Every 2 weeks": 14, Monthly: 30 } as const;
export type Recur = keyof typeof RECUR_DAYS;

export const ROLES = ["owner", "admin", "member", "guest"] as const;
export const ROLE_NAMES = { owner: "Owner", admin: "Admin", member: "Member", guest: "Guest", staff: "StayonSite" } as const;

export const PERMS = [
  { id: "view", name: "Can view" },
  { id: "comment", name: "Can comment" },
  { id: "edit", name: "Can edit" },
  { id: "full", name: "Full access" },
] as const;

export const VIEW_TYPES = ["board", "list", "table", "calendar", "timeline"] as const;

export const INVOICE_STATUS = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  void: "Void",
} as const;

/** Project templates; `engagement` seeds the 11-step process instead of tasks. */
export const TEMPLATES = [
  { id: "blank", name: "Blank project", icon: "folder", desc: "Start from scratch", tasks: [] },
  { id: "engagement", name: "Engagement", icon: "briefcase", desc: "Inquiry to operate, with sign-offs", tasks: [] },
  { id: "agent", name: "AI agent", icon: "sparkles", desc: "Workflow to production agent", tasks: ["Map the workflow with the team", "Collect real examples for evals", "Data access in your environment", "Prototype the agent", "Write guardrails", "Staged rollout"] },
  { id: "search", name: "Search and RAG", icon: "layers", desc: "Index, retrieve, answer", tasks: ["Inventory the sources", "Chunking and indexing", "Retrieval evals", "Answer UI", "Access control per document", "Launch to first team"] },
  { id: "software", name: "Software development", icon: "code", desc: "Spec, build, ship", tasks: ["Technical spec", "Set up repo and CI", "Implement core API", "Write tests", "Code review", "Deploy to staging"] },
  { id: "web", name: "Website", icon: "globe", desc: "IA, design, build, launch", tasks: ["Sitemap and information architecture", "Wireframes", "Visual design", "Build page templates", "Content migration", "QA and launch"] },
] as const;
export type TemplateId = (typeof TEMPLATES)[number]["id"];

export const MAX_UPLOAD = 95 * 1024 * 1024;
