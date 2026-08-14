/**
 * The canvas renders the real section components — the same ones the live site
 * uses, through the same `normalizeBlock` path.
 *
 * The first test here is the most valuable one in the phase: it mounts one node
 * of every registered block type and asserts nothing throws. That single case
 * catches the whole class of "a section needs something the canvas does not
 * provide" — the `useCart` trap below, a future section that grows a server
 * dependency, or a required prop that `normalizeBlock` lets through as
 * undefined.
 *
 * Drag behaviour is NOT simulated: dnd-kit measures the DOM and jsdom has no
 * layout engine (the ResizeObserver stub in the unit setup is inert). Reordering
 * is asserted in store.test.ts, against the pure function the canvas calls, and
 * a real drag is proved in `tests/e2e/builder.spec.ts`.
 *
 * What *is* asserted here is the rendering rule the drop targets follow, which
 * is a plain function of the canvas's props — the reason those props exist
 * rather than the canvas reading `useDndContext` for itself.
 *
 * The `DndContext` wrapper below mirrors the real tree: it lives in
 * `Builder.tsx` now, so the canvas is no longer self-sufficient.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DndContext } from "@dnd-kit/core";

import { blockTypes, manifestFor } from "@/lib/blocks/manifests";
import type { BlockTree } from "@/lib/blocks/types";

import { Canvas } from "./Canvas";
import { BlockErrorBoundary } from "./BlockErrorBoundary";
import { BuilderStoreProvider } from "./StoreContext";
import { newBlockNode } from "./node";

function renderCanvas(
  tree: BlockTree,
  drag: { libraryDragType?: string | null; dropIndex?: number | null } = {}
) {
  return render(
    <BuilderStoreProvider
      init={{
        doc: {
          type: "page",
          id: "p1",
          title: "Homepage",
          slug: "home",
          status: "draft",
          version: 1,
          treeKey: "sections",
          rest: {},
        },
        tree,
      }}
    >
      <DndContext>
        <Canvas {...drag} />
      </DndContext>
    </BuilderStoreProvider>
  );
}

describe("every registered block renders on the canvas", () => {
  it("mounts one node of all 22 types without throwing", () => {
    const tree = blockTypes.map((type) => newBlockNode(type));

    expect(() => renderCanvas(tree)).not.toThrow();

    // Each block's frame carries its key, so the count is the proof.
    expect(document.querySelectorAll("[data-block-key]")).toHaveLength(blockTypes.length);
  });

  it("includes productRow, which calls useCart and would throw without CartProvider", () => {
    // The canvas wraps itself in CartProvider precisely for this. Freedom from
    // server dependencies is not freedom from context.
    expect(blockTypes).toContain("productRow");
    expect(() => renderCanvas([newBlockNode("productRow")])).not.toThrow();
  });
});

describe("block frames", () => {
  it("shows an empty state when the page has no sections", () => {
    renderCanvas([]);
    expect(screen.getByText("Add your first section")).toBeInTheDocument();
  });

  it("offers the frame actions by accessible name", () => {
    const label = manifestFor("pullQuote")!.label;
    renderCanvas([newBlockNode("pullQuote")]);

    for (const action of ["Drag", "Duplicate", "Delete"]) {
      expect(screen.getByRole("button", { name: `${action} ${label}` })).toBeInTheDocument();
    }
  });

  it("duplicates a block from its frame", async () => {
    const label = manifestFor("pullQuote")!.label;
    renderCanvas([newBlockNode("pullQuote")]);

    await userEvent.click(screen.getByRole("button", { name: `Duplicate ${label}` }));
    expect(document.querySelectorAll("[data-block-key]")).toHaveLength(2);
  });

  it("deletes a block from its frame", async () => {
    const label = manifestFor("pullQuote")!.label;
    renderCanvas([newBlockNode("pullQuote"), newBlockNode("masthead")]);

    await userEvent.click(screen.getByRole("button", { name: `Delete ${label}` }));
    expect(document.querySelectorAll("[data-block-key]")).toHaveLength(1);
  });

  it("disables drag, duplicate and delete on a locked block", async () => {
    const label = manifestFor("pullQuote")!.label;
    renderCanvas([newBlockNode("pullQuote")]);

    await userEvent.click(screen.getByRole("button", { name: `Lock ${label}` }));

    expect(screen.getByRole("button", { name: `Drag ${label}` })).toBeDisabled();
    expect(screen.getByRole("button", { name: `Duplicate ${label}` })).toBeDisabled();
    expect(screen.getByRole("button", { name: `Delete ${label}` })).toBeDisabled();
  });

  it("renders a placeholder for a type with no registered component", () => {
    renderCanvas([{ _key: "k1", _type: "noSuchBlock" }]);
    expect(screen.getByText(/unknown block/i)).toBeInTheDocument();
  });
});

describe("drop targets for a library drag", () => {
  it("renders no insertion points when nothing is being dragged in", () => {
    renderCanvas([newBlockNode("pullQuote"), newBlockNode("masthead")]);
    expect(document.querySelectorAll("[data-gap-index]")).toHaveLength(0);
  });

  it("renders one insertion point before each block and one after the last", () => {
    renderCanvas([newBlockNode("pullQuote"), newBlockNode("masthead")], {
      libraryDragType: "newsletter",
    });

    const gaps = [...document.querySelectorAll("[data-gap-index]")].map((node) =>
      node.getAttribute("data-gap-index")
    );
    expect(gaps).toEqual(["0", "1", "2"]);
  });

  it("interleaves the insertion points with the blocks, in document order", () => {
    const tree = [newBlockNode("pullQuote"), newBlockNode("masthead")];
    renderCanvas(tree, { libraryDragType: "newsletter" });

    const marks = [...document.querySelectorAll("[data-gap-index], [data-block-key]")].map(
      (node) =>
        node.hasAttribute("data-gap-index") ? `gap:${node.getAttribute("data-gap-index")}` : "block"
    );
    expect(marks).toEqual(["gap:0", "block", "gap:1", "block", "gap:2"]);
  });

  it("makes the empty page itself a drop target", () => {
    renderCanvas([], { libraryDragType: "newsletter" });

    const gaps = document.querySelectorAll("[data-gap-index]");
    expect(gaps).toHaveLength(1);
    expect(gaps[0].getAttribute("data-gap-index")).toBe("0");
    // The empty state stays visible underneath — it is the drop target, not a
    // thing the drop target replaces.
    expect(screen.getByText("Add your first section")).toBeInTheDocument();
  });

  it("leaves the empty page inert when nothing is being dragged in", () => {
    renderCanvas([]);
    expect(document.querySelectorAll("[data-gap-index]")).toHaveLength(0);
  });
});

describe("BlockErrorBoundary", () => {
  it("contains a block's render failure instead of blanking the builder", () => {
    // normalizeBlock is forgiving by design: a block whose props fail their own
    // schema is rendered with RAW props, so a component can genuinely throw.
    const Boom = () => {
      throw new Error("items.map is not a function");
    };

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      render(
        <div>
          <BlockErrorBoundary type="latestGrid">
            <Boom />
          </BlockErrorBoundary>
          <p>the rest of the builder</p>
        </div>
      );

      expect(screen.getByText(/could not be rendered/i)).toBeInTheDocument();
      expect(screen.getByText("items.map is not a function")).toBeInTheDocument();
      expect(screen.getByText("the rest of the builder")).toBeInTheDocument();
    } finally {
      spy.mockRestore();
    }
  });
});
