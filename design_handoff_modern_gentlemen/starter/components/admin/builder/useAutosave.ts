"use client";

import { useEffect, useRef } from "react";
import { useBuilderStore } from "./StoreContext";
import type { BlockTree } from "@/lib/blocks/types";

/** Idle time before a save fires. */
const DEBOUNCE_MS = 1500;

/** Longest an edit may go unsaved, so continuous typing still checkpoints. */
const MAX_WAIT_MS = 10_000;

export interface SaveDraft {
  (payload: Record<string, unknown>): Promise<{ ok: true } | { ok: false; error: string }>;
}

/**
 * Autosave.
 *
 * A hook rather than store logic because it owns timers and window events, and
 * the store is deliberately free of both.
 *
 * What this does NOT do is decide when a revision is written. `documents.saveDraft`
 * already takes an autosave checkpoint only when the last revision is at least
 * five minutes old, via `shouldWriteAutosaveRevision`. Second-guessing that here
 * would put the same rule in two places, and the version-numbering bug that
 * `0011_autosave.sql` exists to fix is what that costs.
 */
export function useAutosave(saveDraft: SaveDraft): void {
  const store = useBuilderStore();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstDirtyAt = useRef<number | null>(null);
  const inFlight = useRef(false);
  const trailing = useRef(false);

  useEffect(() => {
    async function flush() {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }

      const state = store.getState();
      if (!state.dirty) return;

      // Never overlap: two saves in flight can land out of order, and the older
      // payload would win. Remember that another is wanted instead.
      if (inFlight.current) {
        trailing.current = true;
        return;
      }

      // The exact tree being sent, captured before the await. markSaved compares
      // against this, so an edit made mid-flight leaves the document dirty
      // rather than being silently dropped from the next save.
      const sent: BlockTree = state.tree;
      // And the exact `rest`, which for a template carries every area the store
      // is not currently showing. Both halves are needed: an area switched or
      // edited mid-flight changes `rest` without changing `tree`.
      const sentRest = state.doc.rest;
      const payload = state.payload();

      inFlight.current = true;
      store.getState().markSaving();

      try {
        const result = await saveDraft(payload);
        if (result.ok) store.getState().markSaved(sent, sentRest);
        else store.getState().markSaveError(result.error);
      } catch {
        store.getState().markSaveError("Could not reach the server. Your changes are unsaved.");
      } finally {
        inFlight.current = false;
        firstDirtyAt.current = null;

        if (trailing.current) {
          trailing.current = false;
          void flush();
        }
      }
    }

    const unsubscribe = store.subscribe((state, previous) => {
      // `rest` is watched as well as `tree` because a template's area
      // operations — add, rename, remove — change the payload without touching
      // the open tree. Watching the tree alone meant a renamed area sat unsaved
      // until the editor happened to type into a block.
      if (state.tree === previous.tree && state.doc.rest === previous.doc.rest) return;
      if (!state.dirty) return;

      const now = Date.now();
      firstDirtyAt.current ??= now;

      if (timer.current) clearTimeout(timer.current);

      // Debounce, but never wait longer than MAX_WAIT_MS from the first unsaved
      // edit — otherwise a steady typist is never saved at all.
      const remaining = MAX_WAIT_MS - (now - firstDirtyAt.current);
      timer.current = setTimeout(flush, Math.max(0, Math.min(DEBOUNCE_MS, remaining)));
    });

    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void flush();
      }
    }

    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (store.getState().dirty) event.preventDefault();
    }

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") void flush();
    }

    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      unsubscribe();
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [store, saveDraft]);
}
