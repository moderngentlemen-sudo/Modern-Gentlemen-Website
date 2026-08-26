"use client";

import { type ComponentType } from "react";

import { CartProvider } from "@/lib/cart/CartProvider";
import { CatalogProvider } from "@/lib/catalog/CatalogProvider";
import { products as DEMO_PRODUCTS } from "@/lib/demo/catalog";
import { registry } from "@/components/sections/registry";
import { normalizeBlock } from "@/lib/blocks/normalize";
import { manifestFor } from "@/lib/blocks/manifests";

import { BlockErrorBoundary } from "./BlockErrorBoundary";
import { newBlockNode } from "./node";

/**
 * What a section looks like, before it is added.
 *
 * **It renders the real component, not a picture of one.** `BlockCatalogEntry`
 * has carried an unused `thumb?: string` since Phase 4 — the screenshot route —
 * and this deliberately does not use it. A thumbnail is a second copy of a
 * block's appearance that drifts from the component the moment anyone edits it,
 * and it would drift *silently*: nothing can fail when a picture stops
 * resembling its subject. Rendering the component means the preview and the
 * block an editor actually gets cannot disagree.
 *
 * The scale trick is what makes that affordable: the section renders at a
 * desktop width and is shrunk by a transform, so it lays out exactly as it will
 * on the page rather than reflowing into a 230px rail and showing its mobile
 * breakpoint — which would be a different kind of lie.
 *
 * Both providers are required for the same reason the canvas needs them:
 * `ProductRow` calls `useCart()` and `useCatalog()` and throws without them.
 * Being free of *server* dependencies is not being free of context.
 */

/** The width the section is laid out at, before scaling. Desktop, deliberately. */
const RENDER_WIDTH = 1440;

export const PREVIEW_WIDTH = 420;
export const PREVIEW_HEIGHT = 260;

const SCALE = PREVIEW_WIDTH / RENDER_WIDTH;

export function BlockPreview({ type }: { type: string }) {
  const Component = registry[type as keyof typeof registry] as
    ComponentType<Record<string, unknown>> | undefined;

  if (!Component) return null;

  /**
   * A container renders its children, and a freshly inserted one has none — so
   * previewing it literally shows an empty grid: accurate, and useless.
   *
   * The placeholder is not invented content. It is what the canvas puts in an
   * empty slot, so the preview shows exactly the state an editor lands in after
   * inserting. Fidelity to the inserted block is the whole reason this renders
   * the component rather than a thumbnail, and abandoning it here of all places
   * would be odd.
   */
  const slot = manifestFor(type)?.slot;

  return (
    <div
      /*
        Decorative by design. The entry's label and description are what a
        screen reader gets — pushing a whole section's markup into the
        accessibility tree on hover would bury them, and the preview adds
        nothing a non-sighted reader can use.
      */
      aria-hidden
      data-block-preview={type}
      className="pointer-events-none overflow-hidden border border-mg-fg/15 bg-mg-bg shadow-2xl"
      style={{ width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT }}
    >
      <div
        style={{
          width: RENDER_WIDTH,
          transform: `scale(${SCALE})`,
          transformOrigin: "top left",
        }}
      >
        <CatalogProvider products={DEMO_PRODUCTS}>
          <CartProvider>
            {/*
              A block whose insert defaults fail its own component still has to
              not take the rail down with it. `normalizeBlock` is forgiving on
              the render path, so a component genuinely can throw here.
            */}
            <BlockErrorBoundary type={type}>
              {/*
                Children go to a container and never to a leaf — the same
                asymmetry `SectionRenderer` keeps, so a leaf is rendered here
                with exactly the props it gets everywhere else.
              */}
              {slot ? (
                <Component {...normalizeBlock(newBlockNode(type))}>
                  {/*
                    Heavier than the canvas's equivalent on purpose: at this
                    scale a 1px hairline lands on a fraction of a pixel and
                    disappears, so the placeholder would read as an empty box.
                  */}
                  <div className="flex min-h-[220px] items-center justify-center border-4 border-dashed border-mg-fg/40 p-6 text-center">
                    <p className="font-mono text-[28px] uppercase tracking-[0.16em] text-mg-fg/60">
                      {slot.label}
                    </p>
                  </div>
                </Component>
              ) : (
                <Component {...normalizeBlock(newBlockNode(type))} />
              )}
            </BlockErrorBoundary>
          </CartProvider>
        </CatalogProvider>
      </div>
    </div>
  );
}
