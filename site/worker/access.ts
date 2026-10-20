/**
 * Who may see and do what. Pure functions, so the rules are testable without
 * a database (`npm test`). The portal API calls these for every read and write.
 */

export type Role = "owner" | "admin" | "member" | "guest";
export type Perm = "view" | "comment" | "edit" | "full";

export interface Viewer {
  id: string;
  /** StayonSite team: sees every client and internal-only work. */
  staff: boolean;
  /** Role in the current org; null when not a member. Staff are never members. */
  role: Role | null;
}

export interface ProjectLike {
  private: number | boolean;
  members: Record<string, Perm>;
}

const RANK: Record<Perm, number> = { view: 1, comment: 2, edit: 3, full: 4 };

export const atLeast = (perm: Perm | null, need: Perm) =>
  !!perm && RANK[perm] >= RANK[need];

/** What the viewer may do on a project; null means they can't see it at all. */
export function projectPerm(v: Viewer, p: ProjectLike): Perm | null {
  if (v.staff) return "full";
  if (!v.role) return null;
  const explicit = p.members[v.id];
  if (explicit) return explicit;
  // Guests only see projects they were added to.
  if (p.private || v.role === "guest") return null;
  return v.role === "member" ? "comment" : "edit";
}

/** Rows flagged internal are StayonSite-only. */
export const seesRow = (v: Viewer, row: { internal?: number | boolean | null }) =>
  v.staff || !row.internal;

export const isOrgAdmin = (v: Viewer) =>
  v.staff || v.role === "owner" || v.role === "admin";

/** Gates are the client's sign-off, so staff can't decide on their behalf. */
export function canDecide(
  v: Viewer,
  stage: { gate: string | null; status: string; decision: string | null },
) {
  return (
    !v.staff &&
    (v.role === "owner" || v.role === "admin") &&
    !!stage.gate &&
    stage.status === "active" &&
    stage.decision !== "approved"
  );
}

/** Clients see invoices read-only: owners and admins, and never drafts. */
export const seesInvoice = (v: Viewer, inv: { status: string }) =>
  v.staff || ((v.role === "owner" || v.role === "admin") && inv.status !== "draft");

/**
 * May the viewer move a member from `current` to `next` (null = add / remove)?
 * Only owners touch owners, and an org never loses its last owner.
 */
export function canSetRole(
  v: Viewer,
  current: Role | null,
  next: Role | null,
  owners: number,
) {
  if (!isOrgAdmin(v)) return false;
  if (!v.staff && (current === "owner" || next === "owner") && v.role !== "owner")
    return false;
  if (current === "owner" && next !== "owner" && owners <= 1) return false;
  return true;
}

/** Comment edits belong to the author; staff and project admins can delete. */
export const canEditComment = (v: Viewer, c: { author_id: string }) =>
  c.author_id === v.id;
export const canDeleteComment = (
  v: Viewer,
  c: { author_id: string },
  perm: Perm | null,
) => c.author_id === v.id || v.staff || perm === "full";
