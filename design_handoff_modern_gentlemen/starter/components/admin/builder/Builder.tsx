"use client";

import { useMemo } from "react";

import { clsx } from "@/components/ui/clsx";
import type { ActionResult, SerializedIssue } from "@/app/(admin)/admin/_lib/action-result";
import { HAIRLINE } from "@/components/admin/ui/styles";

import { BuilderStoreProvider, useBuilder } from "./StoreContext";
import { Canvas } from "./Canvas";
import { InsertMenu } from "./InsertMenu";
import { PropertiesPanel } from "./PropertiesPanel";
import { PublishBar } from "./PublishBar";
import { ValidationTray } from "./ValidationTray";
import { useAutosave } from "./useAutosave";
import type { BuilderInit } from "./store";

/**
 * The server actions the builder may call.
 *
 * These must be *references to the actions themselves*, not closures wrapping
 * them. A server action reference is serializable across the server→client
 * boundary; an ordinary arrow function created in a Server Component is not,
 * and Next refuses it at render time with "Functions cannot be passed directly
 * to Client Components". The route originally passed
 * `saveDraft: async (payload) => saveDraftAction({ id, payload })` and threw on
 * every load — invisible to `next build`, and invisible to the unit tests,
 * which hand `Builder` plain fakes.
 *
 * The document id is therefore applied here, on the client, where closing over
 * it is free.
 */
export interface BuilderServerActions {
  saveDraft: (input: {
    id: string;
    payload: Record<string, unknown>;
  }) => Promise<ActionResult<{ savedAt: string }>>;
  publish: (input: { id: string }) => Promise<ActionResult<{ version: number }>>;
  snapshot: (input: { id: string }) => Promise<ActionResult<{ version: number }>>;
  createPreview: (input: {
    id: string;
    device?: "desktop" | "tablet" | "mobile";
  }) => Promise<ActionResult<{ path: string; expiresAt: string }>>;
}

/** What the bar and the autosave hook consume, with the id already bound. */
export interface BuilderCallbacks {
  saveDraft: (payload: Record<string, unknown>) => Promise<ActionResult<{ savedAt: string }>>;
  publish: () => Promise<ActionResult<{ version: number }>>;
  snapshot: () => Promise<ActionResult<{ version: number }>>;
  createPreview: (
    device: "desktop" | "tablet" | "mobile"
  ) => Promise<ActionResult<{ path: string; expiresAt: string }>>;
}

export type { SerializedIssue };

export function Builder({
  init,
  actions,
  canPublish,
  canPreview,
}: {
  init: BuilderInit;
  actions: BuilderServerActions;
  canPublish: boolean;
  canPreview: boolean;
}) {
  const id = init.doc.id;

  const callbacks: BuilderCallbacks = useMemo(
    () => ({
      saveDraft: (payload) => actions.saveDraft({ id, payload }),
      publish: () => actions.publish({ id }),
      snapshot: () => actions.snapshot({ id }),
      createPreview: (device) => actions.createPreview({ id, device }),
    }),
    [actions, id]
  );

  return (
    <BuilderStoreProvider init={init}>
      <BuilderLayout callbacks={callbacks} canPublish={canPublish} canPreview={canPreview} />
    </BuilderStoreProvider>
  );
}

function BuilderLayout({
  callbacks,
  canPublish,
  canPreview,
}: {
  callbacks: BuilderCallbacks;
  canPublish: boolean;
  canPreview: boolean;
}) {
  useAutosave(callbacks.saveDraft);

  const insert = useBuilder((s) => s.insert);
  const selectedKey = useBuilder((s) => s.selectedKey);
  const tree = useBuilder((s) => s.tree);

  return (
    <div className="flex h-screen flex-col">
      <PublishBar callbacks={callbacks} canPublish={canPublish} canPreview={canPreview} />

      <div className="flex min-h-0 flex-1">
        <aside className={clsx("w-[230px] shrink-0 overflow-hidden border-r", HAIRLINE)}>
          <InsertMenu
            onInsert={(type) => {
              // Insert after whatever is selected, so building a page reads
              // top-to-bottom rather than always appending to the end.
              const index = tree.findIndex((node) => node._key === selectedKey);
              insert(type, index === -1 ? undefined : index + 1);
            }}
          />
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto bg-mg-bg">
          <Canvas />
        </main>

        <aside className={clsx("w-[320px] shrink-0 overflow-hidden border-l", HAIRLINE)}>
          <PropertiesPanel />
        </aside>
      </div>

      <ValidationTray />
    </div>
  );
}
