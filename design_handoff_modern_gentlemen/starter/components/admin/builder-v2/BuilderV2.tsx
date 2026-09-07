"use client";

import { useMemo, useState, type ComponentProps } from "react";
import type { Builder, BuilderCallbacks } from "../builder/Builder";
import type { Product } from "@/lib/cart/types";
import { areaNameOf } from "@/lib/blocks/areas";
import { BuilderStoreProvider, useBuilder, useBuilderStore } from "../builder/StoreContext";
import { EditorExperience } from "../builder/EditorExperience";
import { PatternsProvider } from "../builder/PatternsContext";
import { PublishBar } from "../builder/PublishBar";
import { PropertiesPanel } from "../builder/PropertiesPanel";
import { PageSettingsPanel } from "../builder/PageSettingsPanel";
import { ValidationTray } from "../builder/ValidationTray";
import { SaveSelectionAsPattern } from "../builder/SaveSelectionAsPattern";
import { useAutosave } from "../builder/useAutosave";
import { useBuilderShortcuts } from "../builder/useBuilderShortcuts";
import { CatalogProvider } from "@/lib/catalog/CatalogProvider";
import { CartProvider } from "@/lib/cart/CartProvider";
import { V2Canvas } from "./V2Canvas";
import { V2Library } from "./V2Library";

export type V2Props = ComponentProps<typeof Builder> & { products: Product[] };
export function BuilderV2(props: V2Props) {
  return (
    <BuilderStoreProvider key={`${props.init.doc.type}:${props.init.doc.id}`} init={props.init}>
      <EditorExperience initialModern>
        <PatternsProvider patterns={props.patterns ?? []}>
          <CatalogProvider products={props.products}>
            <CartProvider>
              <Workspace {...props} />
            </CartProvider>
          </CatalogProvider>
        </PatternsProvider>
      </EditorExperience>
    </BuilderStoreProvider>
  );
}

function Workspace(props: V2Props) {
  const {
    actions,
    init,
    canPublish,
    canPreview,
    templateOverride,
    previewContexts,
    styleClasses,
    tokenAliases,
  } = props;
  const [panel, setPanel] = useState<"canvas" | "library" | "inspector" | "page">("canvas");
  const store = useBuilderStore();
  const device = useBuilder((s) => s.device);
  const zoom = useBuilder((s) => s.canvasZoom);
  const snap = useBuilder((s) => s.snapToGrid);
  const dirty = useBuilder((s) => s.dirty);
  const id = init.doc.id;
  const callbacks: BuilderCallbacks = useMemo(
    () => ({
      saveDraft: (payload) => actions.saveDraft({ id, payload }),
      publish: () => actions.publish({ id }),
      snapshot: () => actions.snapshot({ id }),
      createPreview: (device, context) =>
        actions.createPreview({
          id,
          device,
          context,
          area: areaNameOf(init.doc.treeKey) ?? undefined,
        }),
      createPatternFromSelection: actions.createPatternFromSelection,
    }),
    [actions, id, init.doc.treeKey]
  );
  useAutosave(callbacks.saveDraft);
  useBuilderShortcuts();
  return (
    <div data-builder-v2 className="flex h-dvh min-h-0 flex-col bg-mg-bg text-mg-fg">
      <PublishBar
        callbacks={callbacks}
        canPublish={canPublish}
        canPreview={canPreview}
        templateOverride={templateOverride}
        previewContexts={previewContexts}
      />
      <div className="flex flex-wrap items-center gap-3 border-b border-mg-bd/20 bg-mg-surface p-3">
        <strong className="text-sm">Builder V2 · Early access</strong>
        <button
          type="button"
          disabled={dirty}
          title={
            dirty
              ? "Wait for autosave or save the draft before switching"
              : "Open the saved document in Original"
          }
          className="border border-mg-bd/30 px-2 py-1 text-xs disabled:opacity-50"
          onClick={() => {
            if (!store.getState().dirty) window.location.assign(`/admin/pages/${id}`);
          }}
        >
          Return to Original
        </button>
        <label className="text-xs">
          Zoom{" "}
          <select
            aria-label="Canvas zoom"
            value={zoom}
            onChange={(e) => store.getState().setCanvasZoom(Number(e.target.value))}
          >
            {[0.5, 0.75, 1, 1.25, 1.5].map((n) => (
              <option key={n} value={n}>
                {n * 100}%
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          aria-pressed={snap}
          onClick={() => store.getState().toggleSnapToGrid()}
          className="border border-mg-bd/30 px-2 py-1 text-xs"
        >
          Snapping {snap ? "on" : "off"}
        </button>
        <span className="text-xs text-mg-fg/70">
          {device} viewport · Same page data · No conversion
        </span>
      </div>
      <div className="flex gap-2 border-b border-mg-bd/20 p-2 lg:hidden">
        {(["canvas", "library", "inspector", "page"] as const).map((p) => (
          <button
            type="button"
            key={p}
            aria-pressed={panel === p}
            onClick={() => setPanel(p)}
            className="border border-mg-bd/30 px-3 py-2 text-sm"
          >
            {p}
          </button>
        ))}
      </div>
      <div className="flex min-h-0 flex-1">
        <aside
          aria-label="V2 library and layers"
          className={`${panel === "library" ? "flex" : "hidden"} w-64 shrink-0 flex-col overflow-auto border-r border-mg-bd/20 lg:flex`}
        >
          <V2Library patterns={props.patterns ?? []} />
        </aside>
        <main className="min-w-0 flex-1 overflow-auto p-8">
          <V2Canvas />
        </main>
        <aside
          aria-label="V2 inspector"
          className={`${panel === "inspector" || panel === "page" ? "flex" : "hidden"} w-80 shrink-0 flex-col overflow-hidden border-l border-mg-bd/20 lg:flex`}
        >
          <div className="flex gap-2 border-b border-mg-bd/20 p-2">
            <button
              type="button"
              aria-pressed={panel !== "page"}
              onClick={() => setPanel("inspector")}
            >
              Element
            </button>
            <button type="button" aria-pressed={panel === "page"} onClick={() => setPanel("page")}>
              Page Settings
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {panel === "page" ? (
              <PageSettingsPanel
                identityAction={actions.savePageIdentity}
                templateOverride={
                  templateOverride ? { noun: "page", id, ...templateOverride } : undefined
                }
              />
            ) : (
              <PropertiesPanel styleClasses={styleClasses} tokenAliases={tokenAliases} />
            )}
          </div>
          {callbacks.createPatternFromSelection && (
            <SaveSelectionAsPattern action={callbacks.createPatternFromSelection} />
          )}
        </aside>
      </div>
      <ValidationTray />
    </div>
  );
}
