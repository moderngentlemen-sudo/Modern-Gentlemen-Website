"use client";

import { useEffect } from "react";

import { useBuilderStore } from "./StoreContext";

function ownsNativeShortcut(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest("input, textarea, select, [contenteditable='true'], [role='dialog']") !== null
  );
}

/**
 * Document-level editing shortcuts for the canvas.
 *
 * They deliberately stand down inside form controls and dialogs. Cmd/Ctrl+A
 * must select text in an input, Backspace must edit it, and Escape belongs to
 * the open dialog's close behavior; stealing any of those would make the
 * builder feel powerful only until someone tried to type.
 */
export function useBuilderShortcuts(): void {
  const store = useBuilderStore();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey || ownsNativeShortcut(event.target)) return;

      const state = store.getState();
      const key = event.key.toLowerCase();
      const modifier = event.metaKey || event.ctrlKey;

      if (modifier && key === "z") {
        const canRun = event.shiftKey ? state.future.length > 0 : state.past.length > 0;
        if (!canRun) return;
        event.preventDefault();
        if (event.shiftKey) state.redo();
        else state.undo();
        return;
      }

      if (modifier && key === "y") {
        if (state.future.length === 0) return;
        event.preventDefault();
        state.redo();
        return;
      }

      if (modifier && key === "d") {
        if (event.repeat || state.selectedKeys.length === 0) return;
        event.preventDefault();
        state.duplicateSelected();
        return;
      }

      if (modifier && key === "a") {
        if (state.tree.length === 0) return;
        event.preventDefault();
        state.selectAll();
        return;
      }

      if (!modifier && (key === "delete" || key === "backspace")) {
        if (state.selectedKeys.length === 0) return;
        event.preventDefault();
        state.removeSelected();
        return;
      }

      if (!modifier && key === "escape" && state.selectedKeys.length > 0) {
        event.preventDefault();
        state.select(null);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [store]);
}
