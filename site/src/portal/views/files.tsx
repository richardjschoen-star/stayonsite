import { Button } from "@/components/base/buttons/button";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import { cx } from "@/utils/cx";
import { RiAttachment2, RiDeleteBinLine, RiDownload2Line, RiEyeOffLine, RiUploadCloud2Line } from "@remixicon/react";
import { useRef, useState } from "react";
import { fileUrl } from "../api";
import { Progress } from "../overlays/drawer";
import { openContextMenu, type MenuItem } from "../overlays/layer";
import { filePreview } from "../overlays/modals";
import { navigate, withTask } from "../router";
import { canComment, personOf, projectOf, remove, save, taskOf, uploadFiles, useSnap } from "../store";
import type { FileRow, Snapshot } from "../types";
import { Empty, FileIcon, PersonAvatar, fmtSize, timeAgo } from "../ui";

const fileMenu = (s: Snapshot, f: FileRow): MenuItem[] => {
  const p = projectOf(s, f.project_id);
  const mine = f.uploaded_by === s.viewer.id || s.viewer.staff || p?.perm === "full";
  return [
    { label: "Preview", icon: RiAttachment2, onSelect: () => filePreview(f, s) },
    { label: "Download", icon: RiDownload2Line, onSelect: () => (location.href = fileUrl(f.id, true)) },
    ...(s.viewer.staff ? [{ label: f.internal ? "Share with client" : "Make internal", icon: RiEyeOffLine, onSelect: () => save("file", f.id, { internal: !f.internal }) }] : []),
    ...(mine ? [{ label: "Delete", icon: RiDeleteBinLine, danger: true, divider: true, onSelect: () => remove("file", f.id) }] : []),
  ];
};

/** A project's files: grid or list, drop anywhere to upload. */
export function FilesView({ projectId }: { projectId: string }) {
  const s = useSnap();
  const p = projectOf(s, projectId);
  const [mode, setMode] = useState<"grid" | "list">(() => (localStorage.getItem("console:files") as "grid" | "list") ?? "grid");
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const files = s.files.filter((f) => f.project_id === projectId);
  const can = canComment(p);
  const go = (list: FileList | null) =>
    list?.length && uploadFiles([...list], { project: projectId }, (n, pct) => setProgress((x) => ({ ...x, [n]: pct }))).then(() => setProgress({}));

  return (
    <div
      className={cx("flex flex-col gap-4 px-4 sm:px-8", over && "rounded-3xl outline-2 outline-dashed outline-border-button-active")}
      onDragOver={(e) => can && (e.preventDefault(), setOver(true))}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => (e.preventDefault(), setOver(false), can && go(e.dataTransfer.files))}
    >
      <div className="flex items-center gap-2">
        <span className="text-body-medium text-text-secondary">{files.length} files</span>
        <span className="flex-1" />
        <SegmentedControl aria-label="Layout" selectedKeys={new Set([mode])} onSelectionChange={(k) => { const m = [...k][0] as "grid" | "list"; if (m) { setMode(m); localStorage.setItem("console:files", m); } }}>
          <SegmentedControlItem id="grid">Grid</SegmentedControlItem>
          <SegmentedControlItem id="list">List</SegmentedControlItem>
        </SegmentedControl>
        {can && (
          <>
            <Button size="small" leadingIcon={RiUploadCloud2Line} onClick={() => input.current?.click()}>
              Upload
            </Button>
            <input ref={input} type="file" multiple hidden onChange={(e) => (go(e.target.files), (e.target.value = ""))} />
          </>
        )}
      </div>
      {Object.entries(progress).map(([n, pct]) => (
        <div key={n} className="flex items-center gap-3 rounded-2xl border border-border-button-default px-4 py-2.5">
          <span className="min-w-0 flex-1 truncate text-body-medium text-text-primary">{n}</span>
          <Progress pct={pct} className="w-40" />
          <span className="w-10 text-end text-caption-1-medium text-text-tertiary tabular-nums">{pct}%</span>
        </div>
      ))}
      {!files.length ? (
        <Empty icon={RiAttachment2} title="No files yet" body={can ? "Drop files here or upload. Clients and StayonSite can both add files; anything internal stays with StayonSite." : "Files shared on this project appear here."} />
      ) : mode === "grid" ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
          {files.map((f) => (
            <button key={f.id} onClick={() => filePreview(f, s)} onContextMenu={(e) => openContextMenu(e, fileMenu(s, f))} className="flex flex-col overflow-hidden rounded-2xl border border-border-button-default text-start outline-none hover:border-border-button-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring">
              <span className="flex h-32 items-center justify-center bg-background-tertiary-default">
                {f.type.startsWith("image/") ? <img src={fileUrl(f.id)} alt="" loading="lazy" className="size-full object-cover" /> : <FileIcon type={f.type} name={f.name} className="size-9" />}
              </span>
              <span className="flex flex-col gap-0.5 p-3">
                <span className="truncate text-body-medium text-text-primary">{f.name}</span>
                <span className="truncate text-caption-1-medium text-text-tertiary">
                  {fmtSize(f.size)} · {personOf(s, f.uploaded_by)?.name ?? "Someone"} · {timeAgo(f.created_at)}
                  {f.internal && " · Internal"}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <ul className="flex flex-col rounded-3xl border border-border-button-default">
          {files.map((f) => {
            const t = taskOf(s, f.task_id);
            const stage = s.stages.find((x) => x.id === f.stage_id);
            return (
              <li key={f.id} onContextMenu={(e) => openContextMenu(e, fileMenu(s, f))} className="flex items-center gap-3 border-b border-separator-border px-4 py-2.5 last:border-b-0">
                <FileIcon type={f.type} name={f.name} />
                <button onClick={() => filePreview(f, s)} className="min-w-0 flex-1 truncate text-start text-body-medium text-text-primary hover:underline">
                  {f.name}
                </button>
                {t && (
                  <button onClick={() => navigate(withTask(t.id))} className="hidden max-w-48 truncate text-body-2-medium text-text-secondary hover:underline md:block">
                    {t.title}
                  </button>
                )}
                {stage && <span className="hidden text-body-2-medium text-text-secondary md:block">{stage.name}</span>}
                {f.internal && <span className="text-caption-1-medium text-status-purple-text">Internal</span>}
                <span className="w-16 text-end text-caption-1-medium text-text-tertiary">{fmtSize(f.size)}</span>
                <PersonAvatar person={personOf(s, f.uploaded_by)} size="xs" />
                <span className="hidden w-20 text-end text-caption-1-medium text-text-tertiary sm:block">{timeAgo(f.created_at)}</span>
                <a href={fileUrl(f.id, true)} aria-label={`Download ${f.name}`} className="rounded-lg p-1.5 text-foreground-icon-secondary hover:bg-background-secondary-hover">
                  <RiDownload2Line className="size-4" aria-hidden />
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
