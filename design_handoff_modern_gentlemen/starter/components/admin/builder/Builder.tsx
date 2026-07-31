"use client";

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
 * The callbacks the builder needs from the outside world.
 *
 * These are server actions, passed down as props. A server action reference IS
 * serializable across the boundary, which is what lets the whole of
 * `components/admin/builder` stay free of any `app/` import and keeps the store
 * testable with plain fakes. It is the same shape `lib/blocks/binding.ts` uses
 * for its injected sources, and for the same reason.
 */
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
  callbacks,
  canPublish,
  canPreview,
}: {
  init: BuilderInit;
  callbacks: BuilderCallbacks;
  canPublish: boolean;
  canPreview: boolean;
}) {
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
