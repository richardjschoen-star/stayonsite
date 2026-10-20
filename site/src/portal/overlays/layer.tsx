import { CloseButton } from "@/components/base/buttons/close-button";
import { Kbd } from "@/components/base/kbd/kbd";
import { MENU_ITEM, MENU_ITEM_INTERACTIVE, MENU_POPOVER_SURFACE } from "@/components/base/dropdown/menu-styles";
import { cx } from "@/utils/cx";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type MouseEvent, type ReactNode } from "react";
import { Dialog, Modal, ModalOverlay } from "react-aria-components";
import type { IconType } from "../ui";

/**
 * Modals and the context menu, each a tiny external store so any action can
 * open one without threading state through the tree (gr8r's `S.ui.modals`).
 */

interface Store<T> {
  get: () => T;
  set: (v: T) => void;
  subscribe: (l: () => void) => () => void;
}

function makeStore<T>(initial: T): Store<T> {
  let value = initial;
  const ls = new Set<() => void>();
  return {
    get: () => value,
    set: (v: T) => {
      value = v;
      ls.forEach((l) => l());
    },
    subscribe: (l) => (ls.add(l), () => void ls.delete(l)),
  };
}

/** Read a store in a component. A plain hook (not `store.use()`), so the React compiler sees it as one. */
export const useExternal = <T,>(store: Store<T>) => useSyncExternalStore(store.subscribe, store.get);

/* -------------------------------------------------------------- modals --- */

interface ModalSpec {
  id: number;
  size: "sm" | "md" | "lg" | "xl";
  render: (close: () => void) => ReactNode;
  /** Runs however the modal closes: a button, Escape, or the backdrop. */
  onClose?: () => void;
}
const modals = makeStore<ModalSpec[]>([]);
let modalId = 0;

export function openModal(render: (close: () => void) => ReactNode, size: ModalSpec["size"] = "md", onClose?: () => void) {
  const id = ++modalId;
  modals.set([...modals.get(), { id, size, render, onClose }]);
  return () => closeModal(id);
}
export function closeModal(id?: number) {
  const list = modals.get();
  const target = id === undefined ? list.at(-1) : list.find((m) => m.id === id);
  if (!target) return;
  modals.set(list.filter((m) => m !== target));
  target.onClose?.();
}
export const anyModalOpen = () => modals.get().length > 0;

const WIDTH = { sm: "w-[min(420px,calc(100vw-2rem))]", md: "w-[min(560px,calc(100vw-2rem))]", lg: "w-[min(760px,calc(100vw-2rem))]", xl: "w-[min(1040px,calc(100vw-2rem))]" };

export function ModalHost() {
  const list = useExternal(modals);
  return list.map((m) => (
    <ModalOverlay
      key={m.id}
      isOpen
      isDismissable
      onOpenChange={(o) => !o && closeModal(m.id)}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-[8vh] transition-opacity duration-200 ease-out data-[entering]:opacity-0 data-[exiting]:opacity-0"
    >
      <Modal
        className={cx(
          WIDTH[m.size],
          "transform-gpu transition-[opacity,transform,filter] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] data-[entering]:scale-[0.92] data-[entering]:opacity-0 data-[entering]:blur-[4px] data-[exiting]:scale-[0.92] data-[exiting]:opacity-0",
        )}
      >
        <Dialog aria-label="Dialog" className="rounded-3xl border border-border-button-default bg-background-primary-default shadow-xl outline-none dark:bg-background-secondary-default">
          {m.render(() => closeModal(m.id))}
        </Dialog>
      </Modal>
    </ModalOverlay>
  ));
}

/** Standard modal body: title row with close, content, optional footer. */
export function Sheet({ title, subtitle, onClose, children, footer, className }: { title: ReactNode; subtitle?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; className?: string }) {
  return (
    <div className="flex max-h-[84vh] flex-col">
      <header className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
        <div className="min-w-0">
          <h2 className="text-title-3-medium text-text-primary">{title}</h2>
          {subtitle && <p className="mt-1 text-body-regular text-text-secondary">{subtitle}</p>}
        </div>
        <CloseButton size="sm" aria-label="Close" onClick={onClose} />
      </header>
      <div className={cx("min-h-0 flex-1 overflow-y-auto px-6 pb-5", className)}>{children}</div>
      {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-separator-border px-6 py-4">{footer}</footer>}
    </div>
  );
}

/* -------------------------------------------------------- context menu --- */

export interface MenuItem {
  label: string;
  icon?: IconType;
  onSelect: () => void;
  danger?: boolean;
  kbd?: string;
  /** Draws a divider above this row. */
  divider?: boolean;
  disabled?: boolean;
}

const ctx = makeStore<{ x: number; y: number; items: MenuItem[] } | null>(null);

/** Right-click (or ⋯ button) menu at the pointer. */
export function openContextMenu(e: MouseEvent, items: MenuItem[]) {
  e.preventDefault();
  e.stopPropagation();
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
  // From a button click, anchor under the button rather than at the pointer.
  const fromButton = e.type === "click";
  ctx.set({ x: fromButton ? r.left : e.clientX, y: fromButton ? r.bottom + 4 : e.clientY, items });
}
export const closeContextMenu = () => ctx.set(null);

export function ContextMenuHost() {
  const menu = useExternal(ctx);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  // Keep the menu on screen.
  useLayoutEffect(() => {
    if (!menu || !ref.current) return setPos(null);
    const { width, height } = ref.current.getBoundingClientRect();
    setPos({ x: Math.min(menu.x, innerWidth - width - 8), y: Math.min(menu.y, innerHeight - height - 8) });
    ref.current.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus();
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    const close = () => ctx.set(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && close();
    addEventListener("keydown", onKey);
    addEventListener("pointerdown", onDown, true);
    addEventListener("resize", close);
    addEventListener("scroll", close, true);
    return () => {
      removeEventListener("keydown", onKey);
      removeEventListener("pointerdown", onDown, true);
      removeEventListener("resize", close);
      removeEventListener("scroll", close, true);
    };
  }, [menu]);

  if (!menu) return null;
  return (
    <div
      ref={ref}
      role="menu"
      style={{ left: pos?.x ?? menu.x, top: pos?.y ?? menu.y, visibility: pos ? "visible" : "hidden" }}
      className={cx(MENU_POPOVER_SURFACE, "fixed z-[70] flex w-56 flex-col gap-0.5 p-1.5")}
      onKeyDown={(e) => {
        if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
        e.preventDefault();
        const items = [...ref.current!.querySelectorAll<HTMLButtonElement>("button:not([disabled])")];
        const i = items.indexOf(document.activeElement as HTMLButtonElement);
        items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
      }}
    >
      {menu.items.map((it, i) => (
        <div key={i} className="contents">
          {it.divider && <div className="-mx-1.5 my-1 h-px bg-border-button-default" />}
          <button
            type="button"
            role="menuitem"
            disabled={it.disabled}
            onClick={() => {
              ctx.set(null);
              it.onSelect();
            }}
            className={cx(MENU_ITEM, MENU_ITEM_INTERACTIVE, "px-2 py-1.5 text-body-medium disabled:cursor-not-allowed disabled:opacity-50", it.danger && "text-text-error-primary")}
          >
            {it.icon && <it.icon className={cx("size-4 shrink-0", it.danger ? "text-foreground-icon-error" : "text-foreground-icon-secondary")} aria-hidden />}
            <span className="flex-1 truncate">{it.label}</span>
            {it.kbd && <Kbd>{it.kbd}</Kbd>}
          </button>
        </div>
      ))}
    </div>
  );
}

export { makeStore };
