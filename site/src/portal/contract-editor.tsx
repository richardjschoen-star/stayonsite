import { cx } from "@/utils/cx";
import {
  RiArrowGoBackLine,
  RiArrowGoForwardLine,
  RiBold,
  RiDoubleQuotesL,
  RiH2,
  RiH3,
  RiItalic,
  RiListOrdered,
  RiListUnordered,
  RiStrikethrough,
} from "@remixicon/react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";

const PROSE_CLS = [
  "prose-sm max-w-none outline-none text-body-regular leading-relaxed text-text-primary",
  "[&_h2]:mt-1 [&_h2]:mb-3 [&_h2]:text-title-2-medium [&_h2]:text-text-primary",
  "[&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-headline-medium [&_h3]:text-text-primary",
  "[&_p]:my-2 [&_p]:text-body-regular [&_p]:text-text-secondary",
  "[&_strong]:font-semibold [&_strong]:text-text-primary",
  "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_ul]:text-text-secondary",
  "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5 [&_ol]:text-text-secondary",
  "[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-accent-500/40 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-text-secondary",
].join(" ");

export function ContractEditor({
  value,
  onChange,
  editable = true,
  className,
}: {
  value: string;
  onChange?: (html: string) => void;
  editable?: boolean;
  className?: string;
}) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    editable,
    editorProps: {
      attributes: {
        class: cx(PROSE_CLS, editable ? "min-h-[340px] px-4 py-3" : "p-0"),
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange?.(ed.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (editor.isEditable !== editable) editor.setEditable(editable);
  }, [editor, editable]);

  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) return null;

  const tools = [
    { icon: RiBold, label: "Bold", active: editor.isActive("bold"), run: () => editor.chain().focus().toggleBold().run() },
    { icon: RiItalic, label: "Italic", active: editor.isActive("italic"), run: () => editor.chain().focus().toggleItalic().run() },
    { icon: RiStrikethrough, label: "Strikethrough", active: editor.isActive("strike"), run: () => editor.chain().focus().toggleStrike().run() },
    { icon: RiH2, label: "Heading 2", active: editor.isActive("heading", { level: 2 }), run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { icon: RiH3, label: "Heading 3", active: editor.isActive("heading", { level: 3 }), run: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
    { icon: RiListUnordered, label: "Bullet list", active: editor.isActive("bulletList"), run: () => editor.chain().focus().toggleBulletList().run() },
    { icon: RiListOrdered, label: "Numbered list", active: editor.isActive("orderedList"), run: () => editor.chain().focus().toggleOrderedList().run() },
    { icon: RiDoubleQuotesL, label: "Quote", active: editor.isActive("blockquote"), run: () => editor.chain().focus().toggleBlockquote().run() },
    { icon: RiArrowGoBackLine, label: "Undo", active: false, run: () => editor.chain().focus().undo().run() },
    { icon: RiArrowGoForwardLine, label: "Redo", active: false, run: () => editor.chain().focus().redo().run() },
  ];

  return (
    <div
      className={cx(
        "overflow-hidden rounded-2xl border",
        editable
          ? "border-border-button-default bg-background-primary-default focus-within:border-accent-500 focus-within:ring-2 focus-within:ring-accent-500/15"
          : "border-separator-border bg-background-secondary-default/40 p-5",
        className,
      )}
    >
      {editable && (
        <div
          role="toolbar"
          aria-label="Contract formatting"
          className="flex flex-wrap items-center gap-0.5 border-b border-separator-border bg-background-secondary-default/50 px-2.5 py-1.5"
        >
          {tools.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.label}
                type="button"
                title={t.label}
                aria-label={t.label}
                aria-pressed={t.active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  t.run();
                }}
                className={cx(
                  "flex size-8 items-center justify-center rounded-lg transition-colors",
                  t.active
                    ? "bg-accent-500/15 text-accent-500"
                    : "text-foreground-icon-secondary hover:bg-background-secondary-hover hover:text-text-primary",
                )}
              >
                <Icon className="size-4" aria-hidden />
              </button>
            );
          })}
        </div>
      )}
      <div className={editable ? "max-h-[440px] overflow-y-auto" : "max-h-[420px] overflow-y-auto"}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
