import { MENU_ITEM, MENU_ITEM_ACTIVE, MENU_POPOVER_SURFACE } from "@/components/base/dropdown/menu-styles";
import { cx } from "@/utils/cx";
import { RiBold, RiCodeLine, RiDoubleQuotesL, RiH2, RiItalic, RiLink, RiListOrdered, RiListUnordered, RiStrikethrough } from "@remixicon/react";
import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import type { Person } from "./types";
import { PersonAvatar, type IconType } from "./ui";

/**
 * The description / comment editor: contenteditable with the small set of
 * formats the Worker's sanitizer keeps, and @mentions as
 * <span data-mention="userId">, which the Worker turns into notifications.
 */

const TOOLS: [IconType, string, string, string?][] = [
  [RiBold, "Bold", "bold"],
  [RiItalic, "Italic", "italic"],
  [RiStrikethrough, "Strikethrough", "strikeThrough"],
  [RiH2, "Heading", "formatBlock", "h3"],
  [RiListUnordered, "Bulleted list", "insertUnorderedList"],
  [RiListOrdered, "Numbered list", "insertOrderedList"],
  [RiDoubleQuotesL, "Quote", "formatBlock", "blockquote"],
  [RiCodeLine, "Code", "formatBlock", "pre"],
  [RiLink, "Link", "createLink"],
];

export const isEmptyHtml = (html: string) => !html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, "").trim() && !html.includes("data-mention");

export function RichEditor({
  value,
  onCommit,
  onSubmit,
  people = [],
  placeholder = "Write something…",
  toolbar = true,
  autoFocus = false,
  minHeight = "min-h-24",
  editorRef,
  label,
  disabled = false,
}: {
  value: string;
  /** Called on blur with the new HTML, only when it changed. */
  onCommit?: (html: string) => void;
  /** ⌘/Ctrl + Enter. */
  onSubmit?: (html: string) => void;
  people?: Person[];
  placeholder?: string;
  toolbar?: boolean;
  autoFocus?: boolean;
  minHeight?: string;
  editorRef?: RefObject<HTMLDivElement | null>;
  label: string;
  disabled?: boolean;
}) {
  const own = useRef<HTMLDivElement>(null);
  const ref = editorRef ?? own;
  // Read the node through a getter: the compiler can't tell a ref merged from a
  // prop is a ref, and would otherwise read `.current` during render.
  const node = () => ref.current;
  const [mention, setMention] = useState<{ q: string; i: number } | null>(null);
  const [empty, setEmpty] = useState(isEmptyHtml(value));

  // Uncontrolled while focused, so typing never fights a re-render.
  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.innerHTML !== value) {
      el.innerHTML = value;
      setEmpty(isEmptyHtml(value));
    }
  }, [value, ref]);
  useEffect(() => {
    if (autoFocus) node()?.focus();
  }, [autoFocus, ref]);

  const matches = mention
    ? people.filter((p) => p.name.toLowerCase().split(/\s+/).some((w) => w.startsWith(mention.q.toLowerCase())) || p.name.toLowerCase().startsWith(mention.q.toLowerCase())).slice(0, 6)
    : [];

  const exec = (cmd: string, arg?: string) => {
    node()?.focus();
    if (cmd === "createLink") {
      const url = prompt("Link to (https://…)")?.trim();
      if (!url || !/^(https?:|mailto:)/i.test(url)) return;
      arg = url;
    }
    document.execCommand(cmd, false, arg);
  };

  const detectMention = () => {
    const sel = getSelection();
    const anchor = sel?.anchorNode;
    if (!sel || !anchor || anchor.nodeType !== Node.TEXT_NODE || !node()?.contains(anchor)) return setMention(null);
    const before = (anchor.textContent ?? "").slice(0, sel.anchorOffset);
    const m = before.match(/(?:^|\s)@([\p{L}\p{N}_-]{0,20})$/u);
    setMention(m && people.length ? { q: m[1], i: 0 } : null);
  };

  const insertMention = (p: Person) => {
    const sel = getSelection();
    const anchor = sel?.anchorNode;
    if (!sel || !anchor || anchor.nodeType !== Node.TEXT_NODE) return;
    const text = anchor.textContent ?? "";
    const at = text.lastIndexOf("@", sel.anchorOffset);
    const range = document.createRange();
    range.setStart(anchor, at);
    range.setEnd(anchor, sel.anchorOffset);
    range.deleteContents();
    const span = document.createElement("span");
    span.dataset.mention = p.id;
    span.contentEditable = "false";
    span.textContent = `@${p.name}`;
    range.insertNode(span);
    const space = document.createTextNode(" ");
    span.after(space);
    sel.collapse(space, 1);
    setMention(null);
    setEmpty(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (mention && matches.length) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const d = e.key === "ArrowDown" ? 1 : -1;
        return setMention({ ...mention, i: (mention.i + d + matches.length) % matches.length });
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        return insertMention(matches[mention.i]);
      }
      if (e.key === "Escape") {
        e.stopPropagation();
        return setMention(null);
      }
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && onSubmit) {
      e.preventDefault();
      onSubmit(node()!.innerHTML);
    }
    if (e.key === "Escape") node()?.blur();
  };

  return (
    <div className="relative rounded-2xl border border-border-button-default bg-background-primary-default transition-colors focus-within:border-border-button-active dark:bg-background-tertiary-default">
      {toolbar && !disabled && (
        <div role="toolbar" aria-label="Formatting" className="flex flex-wrap gap-0.5 border-b border-separator-border px-1.5 py-1">
          {TOOLS.map(([Icon, name, cmd, arg]) => (
            <button
              key={name}
              type="button"
              title={name}
              aria-label={name}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec(cmd, arg)}
              className="rounded-md p-1 text-foreground-icon-secondary outline-none hover:bg-background-secondary-hover hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring"
            >
              <Icon className="size-4" aria-hidden />
            </button>
          ))}
        </div>
      )}
      <div className="relative">
        {empty && <span className="pointer-events-none absolute start-3 top-2.5 text-body-regular text-text-placeholder">{placeholder}</span>}
        <div
          ref={ref}
          role="textbox"
          aria-multiline="true"
          aria-label={label}
          contentEditable={!disabled}
          suppressContentEditableWarning
          onInput={() => {
            setEmpty(isEmptyHtml(node()!.innerHTML));
            detectMention();
          }}
          onKeyDown={onKeyDown}
          onKeyUp={(e) => !["ArrowDown", "ArrowUp", "Enter", "Tab"].includes(e.key) && detectMention()}
          onBlur={() => {
            setTimeout(() => setMention(null), 150);
            // Blur also fires as the editor unmounts (navigating away mid-edit).
            const el = node();
            if (!el) return;
            const html = el.innerHTML;
            if (onCommit && html !== value) onCommit(isEmptyHtml(html) ? "" : html);
          }}
          // Pasting brings plain text only; formatting comes from the toolbar.
          onPaste={(e) => {
            e.preventDefault();
            document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
          }}
          className={cx(
            "rich max-w-none px-3 py-2.5 text-body-regular text-text-primary outline-none [&_a]:text-accent-500 [&_a]:underline [&_blockquote]:border-s-2 [&_blockquote]:border-border-button-default [&_blockquote]:ps-3 [&_blockquote]:text-text-secondary [&_h3]:text-headline-semibold [&_li]:ms-5 [&_ol]:list-decimal [&_pre]:rounded-lg [&_pre]:bg-background-tertiary-default [&_pre]:p-2 [&_span[data-mention]]:rounded [&_span[data-mention]]:bg-accent-500/15 [&_span[data-mention]]:px-0.5 [&_span[data-mention]]:text-accent-500 [&_ul]:list-disc",
            minHeight,
          )}
        />
        {mention && matches.length > 0 && (
          <div role="listbox" aria-label="Mention someone" className={cx(MENU_POPOVER_SURFACE, "absolute start-2 top-full z-20 mt-1 flex w-64 flex-col gap-0.5 p-1.5")}>
            {matches.map((p, i) => (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={i === mention.i}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(p);
                }}
                className={cx(MENU_ITEM, "px-2 py-1.5", i === mention.i && MENU_ITEM_ACTIVE)}
              >
                <PersonAvatar person={p} size="xs" />
                <span className="flex-1 truncate text-body-medium">{p.name}</span>
                <span className="truncate text-caption-1-medium text-text-tertiary">{p.staff ? "StayonSite" : (p.title ?? "")}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
