import { applyThemeWithTransition } from "@/components/application/theme/theme-toggle";
import { useEffect } from "react";
import { STATUSES } from "./constants";
import { anyModalOpen } from "./overlays/layer";
import { newTask, projectModal, shortcutsModal } from "./overlays/modals";
import { closePalette, openPalette, paletteOpen } from "./overlays/palette";
import { getRoute, navigate, to, withTask } from "./router";
import { getState, isAdmin, setTaskStatus, taskOf } from "./store";

/** gr8r's G-then-letter jumps. */
const JUMPS: Record<string, string> = {
  h: "", t: "my-tasks", p: "projects", i: "inbox", c: "calendar", s: "settings", n: "notifications", a: "activity", m: "members",
};

const typing = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || !!el.closest("[role=listbox],[role=menu]"));

/** Every console keyboard shortcut; the list users see lives in SHORTCUTS (modals.tsx). */
export function useKeys({ toggleSidebar }: { toggleSidebar: () => void }) {
  useEffect(() => {
    let g = 0;
    const onKey = (e: KeyboardEvent) => {
      const s = getState().snap;
      if (!s) return;
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();

      if (mod && k === "k") {
        e.preventDefault();
        return paletteOpen() ? closePalette() : openPalette();
      }
      if (mod && e.shiftKey && k === "l") {
        e.preventDefault();
        return void applyThemeWithTransition(document.documentElement.classList.contains("dark") ? "light" : "dark");
      }
      if (e.key === "Escape" && !anyModalOpen() && !paletteOpen() && getRoute().task && !typing(e.target)) {
        return navigate(withTask(null));
      }
      if (mod || e.altKey || typing(e.target) || anyModalOpen() || paletteOpen()) return;

      if (Date.now() - g < 1200 && k in JUMPS) {
        g = 0;
        e.preventDefault();
        return navigate(to(s.org.slug, JUMPS[k]));
      }
      if (k === "g") return void (g = Date.now());

      const open = taskOf(s, getRoute().task);
      if (open && /^[1-5]$/.test(e.key)) return setTaskStatus(open, STATUSES[Number(e.key) - 1].id);
      if (open && k === "e") {
        e.preventDefault();
        return document.querySelector<HTMLTextAreaElement>("textarea[aria-label='Task title']")?.focus();
      }
      if (e.key === "/") return (e.preventDefault(), openPalette("search"));
      if (e.key === "?") return shortcutsModal();
      if (e.key === "[") return toggleSidebar();
      if (k === "n") {
        e.preventDefault();
        const r = getRoute();
        return newTask(r.name === "project" && r.id ? { project_id: r.id } : {});
      }
      if (k === "p" && isAdmin(s)) return (e.preventDefault(), projectModal());
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [toggleSidebar]);
}
