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
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DndContext } from "@dnd-kit/core";

import { blockTypes, manifestFor } from "@/lib/blocks/manifests";
import { flattenBlocks } from "@/lib/blocks/traverse";
import type { BlockTree } from "@/lib/blocks/types";

import { Canvas } from "./Canvas";
import { BlockErrorBoundary } from "./BlockErrorBoundary";
import { BuilderStoreProvider } from "./StoreContext";
import { newBlockNode } from "./node";

function renderCanvas(
  tree: BlockTree,
  drag: {
    libraryDragType?: string | null;
    drop?: { parentKey: string | null; index: number } | null;
  } = {}
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
  it("mounts one node of every registered type without throwing", () => {
    const tree = blockTypes.map((type) => newBlockNode(type));

    expect(() => renderCanvas(tree)).not.toThrow();

    // Each block's frame carries its key, so the count is the proof — counted
    // over the flattened tree rather than `blockTypes`, because `columns`
    // arrives holding two seeded columns and those are frames too.
    expect(document.querySelectorAll("[data-block-key]")).toHaveLength(flattenBlocks(tree).length);
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

  it("dims but keeps a block editable when it is excluded from the preview device", () => {
    const node = newBlockNode("pullQuote");
    node.visibility = { devices: ["mobile"] };
    renderCanvas([node]);

    const frame = document.querySelector(`[data-block-key="${node._key}"]`)!;
    expect(frame.querySelector("[data-preview-hidden='true']")).not.toBeNull();
    expect(screen.getByRole("button", { name: /^Duplicate/ })).toBeEnabled();
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

describe("containers on the canvas", () => {
  /**
   * A **column**, which is the unrestricted container: any child type, no seeded
   * children. The `columns` row is the specialised one and has its own cases
   * below, because what it refuses is the whole point of it.
   */
  const container = (children: BlockTree): BlockTree => [{ _key: "C1", _type: "column", children }];

  it("renders a container's children inside it", () => {
    renderCanvas(container([newBlockNode("pullQuote"), newBlockNode("masthead")]));

    // Three frames: the container and its two children, all in one document
    // order — which is what the nested SortableContexts have to preserve.
    expect(document.querySelectorAll("[data-block-key]")).toHaveLength(3);
  });

  it("offers an empty container its own drop target, whatever is being dragged", () => {
    // Unlike the gaps, this one is registered even for a block drag: it is the
    // only way an existing block can be moved into an empty container.
    renderCanvas(container([]));

    const slot = document.querySelector("[data-gap-parent='C1']");
    expect(slot).not.toBeNull();
    expect(slot!.getAttribute("data-gap-index")).toBe("0");
  });

  it("renders insertion points inside a container during a library drag", () => {
    renderCanvas(container([newBlockNode("pullQuote")]), { libraryDragType: "newsletter" });

    const nested = [...document.querySelectorAll("[data-gap-parent='C1']")].map((n) =>
      n.getAttribute("data-gap-index")
    );
    expect(nested).toEqual(["0", "1"]);

    // The root list keeps its own, and they are distinguishable by parent.
    const root = [...document.querySelectorAll("[data-gap-index]")].filter(
      (n) => !n.hasAttribute("data-gap-parent")
    );
    expect(root).toHaveLength(2);
  });

  it("highlights only the gap the pointer is in, container included", () => {
    renderCanvas(container([newBlockNode("pullQuote")]), {
      libraryDragType: "newsletter",
      drop: { parentKey: "C1", index: 1 },
    });

    const highlighted = [...document.querySelectorAll("[data-gap-index]")].filter((n) =>
      n.querySelector(".bg-mg-accent")
    );
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0].getAttribute("data-gap-parent")).toBe("C1");
    expect(highlighted[0].getAttribute("data-gap-index")).toBe("1");
  });

  it("does not disable pointer events inside a container", () => {
    // The navigation killer is a descendant selector, so applying it to a
    // container would reach every nested block's own toolbar and make its drag,
    // lock, duplicate and delete buttons silently unclickable.
    renderCanvas(container([newBlockNode("pullQuote")]));

    const frames = [...document.querySelectorAll("[data-block-key]")];
    const containerFrame = frames.find((f) => f.getAttribute("data-block-key") === "C1")!;
    const inner = containerFrame.querySelector("div")!;

    expect(inner.className).not.toContain("pointer-events-none");
  });

  it("still disables pointer events on a leaf", () => {
    renderCanvas([newBlockNode("pullQuote")]);
    const inner = document.querySelector("[data-block-key] > div")!;
    expect(inner.className).toContain("[&_a]:pointer-events-none");
  });

  it("keeps a nested block's frame actions reachable by name", async () => {
    const label = manifestFor("pullQuote")!.label;
    renderCanvas(container([newBlockNode("pullQuote")]));

    await userEvent.click(screen.getByRole("button", { name: `Duplicate ${label}` }));
    expect(document.querySelectorAll("[data-block-key]")).toHaveLength(3);
  });
});

describe("selecting inside a container", () => {
  it("selects the innermost block, not the container around it", async () => {
    // Every frame carries the same mousedown handler, so without
    // `stopPropagation` the click bubbles to the container's frame, whose
    // handler runs last and wins — leaving the panel showing the container
    // whenever an editor clicks something inside one. Nothing throws, which is
    // why this was found by driving a real browser rather than by reading.
    renderCanvas([{ _key: "C1", _type: "columns", children: [newBlockNode("pullQuote")] }]);

    const frames = [...document.querySelectorAll("[data-block-key]")];
    const outer = frames.find((f) => f.getAttribute("data-block-key") === "C1")!;
    const inner = frames.find((f) => f.getAttribute("data-block-key") !== "C1")!;

    await userEvent.click(inner);

    // The selection ring is the observable: the inner frame wears it, and the
    // container's own ring — its direct child, not the nested one — does not.
    expect(inner.querySelector(".ring-mg-accent")).not.toBeNull();
    expect(outer.querySelector(":scope > .ring-mg-accent")).toBeNull();
  });
});

describe("direct canvas manipulation", () => {
  it("zooms the viewport and toggles editor-only rulers", async () => {
    renderCanvas([{ _key: "a", _type: "pullQuote" }]);
    await userEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(screen.getByRole("button", { name: "Reset canvas zoom" })).toHaveTextContent("90%");
    await userEvent.click(screen.getByRole("button", { name: "Rulers" }));
    expect(document.querySelectorAll("[data-canvas-ruler]")).toHaveLength(2);
  });

  it("pans the scrollable workspace with the hand tool without selecting content", async () => {
    renderCanvas([{ _key: "a", _type: "pullQuote" }]);
    await userEvent.click(screen.getByRole("button", { name: "Hand" }));
    const viewport = document.querySelector<HTMLElement>("[data-canvas-viewport]")!;
    viewport.scrollLeft = 120;
    viewport.scrollTop = 80;

    const down = new Event("pointerdown", { bubbles: true });
    Object.defineProperties(down, {
      button: { value: 0 },
      pointerId: { value: 4 },
      clientX: { value: 300 },
      clientY: { value: 200 },
    });
    fireEvent(viewport, down);
    const move = new Event("pointermove", { bubbles: true });
    Object.defineProperties(move, {
      pointerId: { value: 4 },
      clientX: { value: 240 },
      clientY: { value: 150 },
    });
    fireEvent(viewport, move);

    expect(viewport.scrollLeft).toBe(180);
    expect(viewport.scrollTop).toBe(130);
    expect(viewport.className).toContain("cursor-grabbing");

    const up = new Event("pointerup", { bubbles: true });
    Object.defineProperty(up, "pointerId", { value: 4 });
    fireEvent(viewport, up);
    expect(viewport.className).toContain("cursor-grab");
    expect(document.querySelector("[data-block-key='a'] > .ring-mg-accent")).toBeNull();
  });

  it("temporarily activates the hand while Space is held", () => {
    renderCanvas([{ _key: "a", _type: "pullQuote" }]);
    const viewport = document.querySelector<HTMLElement>("[data-canvas-viewport]")!;
    const frame = document.querySelector<HTMLElement>("[data-block-key='a']")!;

    fireEvent.keyDown(window, { code: "Space" });
    expect(viewport.className).toContain("cursor-grab");
    fireEvent.mouseDown(frame);
    expect(frame.querySelector(":scope > .ring-mg-accent")).toBeNull();

    fireEvent.keyUp(window, { code: "Space" });
    expect(viewport.className).not.toContain("cursor-grab");
  });

  it("leaves Space available to a focused control", () => {
    renderCanvas([{ _key: "a", _type: "pullQuote" }]);
    const viewport = document.querySelector<HTMLElement>("[data-canvas-viewport]")!;
    const selectTool = screen.getByRole("button", { name: "Select" });

    fireEvent.keyDown(selectTool, { code: "Space" });
    expect(viewport.className).not.toContain("cursor-grab");
  });

  it("selects several elements with a modifier and exposes group actions", () => {
    renderCanvas([
      { _key: "a", _type: "pullQuote" },
      { _key: "b", _type: "pullQuote" },
    ]);
    const [first, second] = document.querySelectorAll<HTMLElement>("[data-block-key]");
    fireEvent.mouseDown(first);
    fireEvent.mouseDown(second, { shiftKey: true });
    expect(screen.getByText("2 elements selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Duplicate" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("resizes the selected element from its canvas edge", () => {
    renderCanvas([{ _key: "a", _type: "pullQuote" }]);
    const frame = document.querySelector<HTMLElement>("[data-block-key='a']")!;
    vi.spyOn(frame, "getBoundingClientRect").mockReturnValue({
      width: 1000,
      height: 400,
      top: 0,
      right: 1000,
      bottom: 400,
      left: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    fireEvent.mouseDown(frame);
    const handle = screen.getByRole("button", { name: "Resize Pull quote" });
    const down = new Event("pointerdown", { bubbles: true });
    Object.defineProperty(down, "clientX", { value: 1000 });
    fireEvent(handle, down);
    const move = new Event("pointermove", { bubbles: true });
    Object.defineProperty(move, "clientX", { value: 600 });
    fireEvent(window, move);
    fireEvent.pointerUp(window);
    expect(document.querySelector("style[data-mg-visual-style]")?.textContent).toContain(
      "width:60%"
    );
  });

  it("snaps a resized edge to peer geometry and clears its alignment guide on release", () => {
    renderCanvas([
      { _key: "a", _type: "pullQuote" },
      { ...newBlockNode("masthead"), _key: "b" },
    ]);
    const frame = document.querySelector<HTMLElement>("[data-block-key='a']")!;
    const peer = document.querySelector<HTMLElement>("[data-block-key='b']")!;
    const sheet = document.querySelector<HTMLElement>("[data-canvas-sheet]")!;
    const viewport = document.querySelector<HTMLElement>("[data-canvas-viewport]")!;
    const rect = (left: number, width: number, height = 400) =>
      ({
        width,
        height,
        top: 0,
        right: left + width,
        bottom: height,
        left,
        x: left,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    vi.spyOn(frame, "getBoundingClientRect").mockReturnValue(rect(0, 1000));
    vi.spyOn(peer, "getBoundingClientRect").mockReturnValue(rect(602, 100));
    vi.spyOn(sheet, "getBoundingClientRect").mockReturnValue(rect(0, 1400));
    vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue(rect(0, 1200));

    fireEvent.mouseDown(frame);
    const handle = screen.getByRole("button", { name: "Resize Pull quote" });
    const down = new Event("pointerdown", { bubbles: true });
    Object.defineProperty(down, "clientX", { value: 1000 });
    fireEvent(handle, down);
    const move = new Event("pointermove", { bubbles: true });
    Object.defineProperty(move, "clientX", { value: 600 });
    fireEvent(window, move);

    expect(document.querySelector("style[data-mg-visual-style]")?.textContent).toContain(
      "width:60.2%"
    );
    expect(
      document.querySelector<HTMLElement>("[data-alignment-guide='vertical']")?.style.left
    ).toBe("602px");

    fireEvent.pointerUp(window);
    expect(document.querySelector("[data-alignment-guide]")).toBeNull();
  });
});

describe("nested chrome", () => {
  it("stacks a nested block's toolbar above its container's", async () => {
    // Both frames pin their controls to their own top-right, and `group-hover`
    // fires for every ancestor group — so both are on screen at once and their
    // corners can overlap. Flat z-indexes let the container's toolbar swallow
    // clicks meant for the block inside it, which CI found as a flaky drag spec
    // rather than as a bug report.
    renderCanvas([{ _key: "C1", _type: "columns", children: [newBlockNode("pullQuote")] }]);

    const frames = [...document.querySelectorAll("[data-block-key]")];
    const outer = frames.find((f) => f.getAttribute("data-block-key") === "C1")!;
    const inner = frames.find((f) => f.getAttribute("data-block-key") !== "C1")!;

    const zOf = (frame: Element) =>
      Number(
        [...frame.querySelectorAll<HTMLElement>(":scope > div")].find((d) => d.style.zIndex)?.style
          .zIndex ?? "0"
      );

    expect(zOf(inner)).toBeGreaterThan(zOf(outer));
  });
});

/**
 * The columns row, and the defect that produced it.
 *
 * Reported from the builder: after dropping the first section into a column,
 * dragging another into a *different* column did nothing. The cause was that a
 * column was not a thing — the row held one flat list and the grid decided
 * which cell each child landed in by index — so there was no per-column drop
 * target to hit, and the canvas's insertion strips were themselves grid items.
 *
 * These are the assertions that fail against that design.
 */
describe("a columns row on the canvas", () => {
  const row = (children: BlockTree): BlockTree => [{ _key: "R1", _type: "columns", children }];
  const column = (key: string, children: BlockTree = []): BlockTree[number] => ({
    _key: key,
    _type: "column",
    children,
  });

  it("puts only its columns in the grid, never an insertion strip", () => {
    // THE defect, asserted directly. The strips are siblings of the children,
    // so inside a container they are children of whatever it renders — and a
    // row renders a CSS grid. Every strip used to take a cell: two columns
    // holding one block each laid out as five cells mid-drag.
    renderCanvas(row([column("A", [newBlockNode("pullQuote")]), column("B")]), {
      libraryDragType: "newsletter",
    });

    const grid = document.querySelector("div.grid")!;
    const cells = [...grid.children].map((cell) =>
      cell.hasAttribute("data-gap-index") ? "GAP" : (cell.getAttribute("data-block-key") ?? "?")
    );

    expect(cells).toEqual(["A", "B"]);
  });

  it("offers each empty column its own drop target", () => {
    // The other half: a section can now be aimed at the second column
    // specifically, rather than at an index in one shared list.
    renderCanvas(row([column("A"), column("B")]), { libraryDragType: "newsletter" });

    const targets = [...document.querySelectorAll("[data-gap-parent]")].map((node) =>
      node.getAttribute("data-gap-parent")
    );

    expect(targets).toContain("A");
    expect(targets).toContain("B");
  });

  it("lets a column that already holds something take another", () => {
    // Stacking two blocks in one cell was impossible under the flat list: a
    // second block simply moved to the next column.
    renderCanvas(row([column("A", [newBlockNode("pullQuote")]), column("B")]), {
      libraryDragType: "newsletter",
    });

    const inA = [...document.querySelectorAll("[data-gap-parent='A']")].map((node) =>
      node.getAttribute("data-gap-index")
    );

    expect(inA).toEqual(["0", "1"]);
  });

  it("offers the row itself no insertion point for a section", () => {
    // `allow: ["column"]`. Refusing here is what keeps the grid intact — and a
    // drop the row would only reject at publish is worse than no drop at all.
    renderCanvas(row([column("A")]), { libraryDragType: "newsletter" });

    const onRow = [...document.querySelectorAll("[data-gap-parent='R1']")];
    expect(onRow).toHaveLength(0);
  });
});

describe("frame chrome cannot swallow a neighbour's click", () => {
  /**
   * ⚠️ Found by CI on the first run after columns became containers.
   *
   * A frame's toolbar is absolutely positioned, so it is not bounded by the
   * column it belongs to. With blocks stacked vertically that never mattered;
   * side by side, the Newsletter's label chip in the second column sat over the
   * Timeline's Duplicate button in the first and swallowed every click on it —
   * Playwright reporting "subtree intercepts pointer events" and timing out on
   * a button it could see perfectly well.
   *
   * The label and the issue badge are decorative and must never take a click.
   */
  it("takes no pointer events on the bar, and gives them back to each control", () => {
    renderCanvas([newBlockNode("pullQuote")]);

    const bar = screen.getByRole("button", { name: /^Duplicate/ }).parentElement!;
    expect(bar.className).toContain("pointer-events-none");

    for (const button of bar.querySelectorAll("button")) {
      expect(button.className).toContain("pointer-events-auto");
    }
  });
});
