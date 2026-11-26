import { DataGrid, type DataGridColumn } from "@/components/application/data-grid/data-grid";
import { PRIOS, STATUSES } from "../constants";
import { archive, canEdit, personOf, projectOf, save, taskKey, useSnap } from "../store";
import type { Task } from "../types";
import { Empty } from "../ui";
import { RiTableLine } from "@remixicon/react";

interface Row {
  id: string;
  key: string;
  title: string;
  status: string;
  priority: string;
  assignee: string;
  due: string;
  start: string;
  estimate: string;
  labels: string;
  project: string;
}

const UNASSIGNED = "Unassigned";
const date = (v: string | number) => (v === "" || /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? undefined : "Use YYYY-MM-DD");

/**
 * The table view is BoardUI's DataGrid (inline edit, sort, filter, resize,
 * paste, export) over flat rows; edits are diffed back into task saves.
 */
export function TaskTable({ tasks, showProject = false }: { tasks: Task[]; showProject?: boolean }) {
  const s = useSnap();
  const names = s.people.map((p) => p.name);
  const rows: Row[] = tasks.map((t) => ({
    id: t.id,
    key: taskKey(s, t),
    title: t.title,
    status: STATUSES.find((x) => x.id === t.status)!.name,
    priority: PRIOS.find((x) => x.id === t.priority)!.name,
    assignee: personOf(s, t.assignee_id)?.name ?? UNASSIGNED,
    due: t.due ?? "",
    start: t.start ?? "",
    estimate: t.estimate ?? "",
    labels: t.labels.join(", "),
    project: projectOf(s, t.project_id)?.name ?? "",
  }));
  const editable = tasks.some((t) => canEdit(projectOf(s, t.project_id)));

  const columns: DataGridColumn<Row>[] = [
    { key: "key", header: "ID", width: 90 },
    { key: "title", header: "Title", width: 320, editable, validate: (v) => (String(v).trim() ? undefined : "A task needs a title") },
    { key: "status", header: "Status", width: 130, type: "select", options: STATUSES.map((x) => x.name), editable, filterable: true },
    { key: "priority", header: "Priority", width: 120, type: "select", options: PRIOS.map((x) => x.name), editable, filterable: true },
    { key: "assignee", header: "Assignee", width: 160, type: "select", options: [UNASSIGNED, ...names], editable, filterable: true },
    { key: "due", header: "Due", width: 120, editable, validate: date },
    { key: "start", header: "Start", width: 120, editable, validate: date },
    { key: "estimate", header: "Estimate", width: 100, editable },
    { key: "labels", header: "Labels", width: 160 },
    ...(showProject ? [{ key: "project" as const, header: "Project", width: 180, filterable: true }] : []),
  ];

  const onDataChange = (next: Row[]) => {
    const byId = new Map(next.map((r) => [r.id, r]));
    for (const old of rows) {
      const t = tasks.find((x) => x.id === old.id)!;
      if (!canEdit(projectOf(s, t.project_id))) continue;
      const r = byId.get(old.id);
      if (!r) {
        archive("task", t.id, t.title);
        continue;
      }
      const patch: Partial<Task> = {};
      if (r.title !== old.title) patch.title = r.title.trim();
      if (r.status !== old.status) patch.status = STATUSES.find((x) => x.name === r.status)!.id;
      if (r.priority !== old.priority) patch.priority = PRIOS.find((x) => x.name === r.priority)!.id;
      if (r.assignee !== old.assignee) patch.assignee_id = s.people.find((p) => p.name === r.assignee)?.id ?? null;
      if (r.due !== old.due) patch.due = r.due || null;
      if (r.start !== old.start) patch.start = r.start || null;
      if (r.estimate !== old.estimate) patch.estimate = r.estimate.trim() || null;
      if (Object.keys(patch).length) void save("task", t.id, patch);
    }
  };

  return (
    <div className="px-4 sm:px-8">
      <DataGrid
        aria-label="Tasks"
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        onDataChange={editable ? onDataChange : undefined}
        height={Math.min(720, 120 + rows.length * 40)}
        exportFileName={`${s.org.slug}-tasks`}
        emptyState={<Empty icon={RiTableLine} title="No tasks match" />}
      />
    </div>
  );
}
