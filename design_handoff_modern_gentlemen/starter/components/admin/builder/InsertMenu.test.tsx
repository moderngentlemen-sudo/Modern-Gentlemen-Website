/**
 * The library rail became a drag source in the drag-from-library slice, and the
 * risk that carries is a silent one: dnd-kit's activator listeners include the
 * `KeyboardSensor`'s `onKeyDown`, which claims Enter and Space and calls
 * `preventDefault`. Spreading them wholesale would have turned every entry into
 * a drag-only control for anyone not using a mouse, with nothing failing.
 *
 * So the assertions here are about the path that must NOT regress: click, and
 * keyboard activation, still insert.
 */

import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";

import { manifestFor } from "@/lib/blocks/manifests";

import { InsertMenu, type PatternEntry } from "./InsertMenu";

const LABEL = manifestFor("pullQuote")!.label;

/**
 * The activation constraint is not incidental to these tests — it is the whole
 * reason a click still reaches the button.
 *
 * Once dnd-kit activates a drag it adds a capture-phase `click` listener on the
 * document that stops propagation, so React never sees the click. With the 6px
 * distance constraint the builder configures, a stationary press never
 * activates and the click lands. Written first with a bare `DndContext` — whose
 * default sensors have no constraint — this file failed exactly that way.
 */
function Harness({ onInsert }: { onInsert: (type: string) => void }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  return (
    <DndContext sensors={sensors}>
      <InsertMenu onInsert={onInsert} />
    </DndContext>
  );
}

function renderMenu() {
  const onInsert = vi.fn();
  render(<Harness onInsert={onInsert} />);
  return onInsert;
}

describe("InsertMenu", () => {
  it("inserts on click", async () => {
    const onInsert = renderMenu();

    await userEvent.click(screen.getByRole("button", { name: new RegExp(LABEL) }));

    expect(onInsert).toHaveBeenCalledWith("pullQuote");
  });

  it("still inserts from the keyboard — the drag must not claim Enter", async () => {
    const onInsert = renderMenu();

    screen.getByRole("button", { name: new RegExp(LABEL) }).focus();
    await userEvent.keyboard("{Enter}");

    expect(onInsert).toHaveBeenCalledWith("pullQuote");
  });

  it("filters the catalogue by the search box", async () => {
    renderMenu();

    await userEvent.type(screen.getByLabelText("Add a section"), "no such section");

    expect(screen.getByText(/No section matches/)).toBeInTheDocument();
  });
});

describe("section previews", () => {
  it("shows nothing until an entry is hovered", () => {
    renderMenu();
    expect(document.querySelector("[data-block-preview]")).toBeNull();
  });

  it("previews the real section on hover, not a picture of one", async () => {
    renderMenu();

    await userEvent.hover(screen.getByRole("button", { name: new RegExp(LABEL) }));

    const preview = document.querySelector("[data-block-preview]");
    expect(preview).not.toBeNull();
    expect(preview!.getAttribute("data-block-preview")).toBe("pullQuote");
    // The component's own output, rendered from its insert defaults — which is
    // the whole point: a thumbnail could not contain this.
    expect(preview!.textContent).toContain(
      manifestFor("pullQuote")!.insertDefaults.quote as string
    );
  });

  it("hides the preview when the pointer leaves", async () => {
    renderMenu();
    const entry = screen.getByRole("button", { name: new RegExp(LABEL) });

    await userEvent.hover(entry);
    await userEvent.unhover(entry);

    expect(document.querySelector("[data-block-preview]")).toBeNull();
  });

  it("previews on keyboard focus too", async () => {
    // The rail's accessible path is the keyboard; a preview only a mouse could
    // reach would be a feature built for half its users.
    //
    // `act` is not ceremony here: a bare `.focus()` leaves React's state update
    // unflushed, so the assertion reads the DOM from before the event.
    renderMenu();

    await act(async () => {
      screen.getByRole("button", { name: new RegExp(LABEL) }).focus();
    });

    expect(document.querySelector("[data-block-preview]")).not.toBeNull();
  });

  it("keeps the preview out of the accessibility tree", async () => {
    // A whole section's markup pushed into the tree on hover would bury the
    // label and description that actually describe the block.
    renderMenu();
    await userEvent.hover(screen.getByRole("button", { name: new RegExp(LABEL) }));

    expect(document.querySelector("[data-block-preview]")!.getAttribute("aria-hidden")).toBe(
      "true"
    );
  });

  it("renders one preview at a time", async () => {
    renderMenu();
    const other = manifestFor("newsletter")!.label;

    await userEvent.hover(screen.getByRole("button", { name: new RegExp(LABEL) }));
    await userEvent.hover(screen.getByRole("button", { name: new RegExp(other) }));

    const previews = document.querySelectorAll("[data-block-preview]");
    expect(previews).toHaveLength(1);
    expect(previews[0].getAttribute("data-block-preview")).toBe("newsletter");
  });
});

describe("the preview never blocks the canvas", () => {
  it("is inert to the pointer, wrapper included", async () => {
    // The panel is positioned over the canvas and stays open while the pointer
    // rests on an entry — which is exactly where click-to-insert leaves it. An
    // interactive wrapper therefore swallows the next click on the section
    // underneath, and CI found it as a media spec that clicks a block right
    // after inserting one.
    renderMenu();
    await userEvent.hover(screen.getByRole("button", { name: new RegExp(LABEL) }));

    const preview = document.querySelector("[data-block-preview]")!;
    expect(preview.className).toContain("pointer-events-none");
    expect(preview.parentElement!.className).toContain("pointer-events-none");
  });
});

/**
 * Pattern grouping — the payoff for collecting `category_id` at last.
 *
 * `pattern_categories` has held five seeded rows since `0003_content_spine.sql`
 * and `patterns.category_id` referenced them with nothing writing the column,
 * so every pattern landed in one flat "Patterns" heading. These assert the
 * three things that grouping has to get right: the seeded order, the
 * uncategorised fallback, and that a search which empties a group removes its
 * heading too.
 */
const PATTERNS: PatternEntry[] = [
  {
    id: "p1",
    name: "Editorial trio",
    description: "Three cards with a lead image.",
    blockCount: 3,
    category: { label: "Editorial", position: 1 },
  },
  {
    id: "p2",
    name: "Hero with video",
    description: null,
    blockCount: 1,
    category: { label: "Heroes", position: 0 },
  },
  { id: "p3", name: "Unfiled layout", description: null, blockCount: 2, category: null },
];

function renderWithPatterns(patterns = PATTERNS) {
  const onInsertPattern = vi.fn();
  render(<InsertMenu onInsert={() => {}} patterns={patterns} onInsertPattern={onInsertPattern} />);
  return onInsertPattern;
}

describe("patterns in the rail", () => {
  it("groups them under their categories, in the categories' own order", () => {
    renderWithPatterns();

    const headings = screen
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent)
      // The block categories share the heading level; only the pattern groups
      // are asserted here.
      .filter((label) => ["Heroes", "Editorial", "Patterns"].includes(label ?? ""));

    // Heroes is position 0 and Editorial 1, so seeded order — not alphabetical,
    // which would put Editorial first and is the bug this pins.
    expect(headings).toEqual(["Heroes", "Editorial", "Patterns"]);
  });

  it("files an uncategorised pattern under the heading the rail always had", () => {
    renderWithPatterns([PATTERNS[2]]);

    expect(screen.getByRole("heading", { level: 3, name: "Patterns" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Unfiled layout/ })).toBeInTheDocument();
  });

  it("shows the description where it has one and the section count where it does not", () => {
    renderWithPatterns();

    // The whole reason `description` was worth collecting: until now every
    // entry fell through to the count, because nothing ever wrote the column.
    expect(
      screen.getByRole("button", { name: /Three cards with a lead image/ })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /1 section$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /2 sections$/ })).toBeInTheDocument();
  });

  it("drops a heading whose patterns no longer match the search", async () => {
    renderWithPatterns();

    await userEvent.type(screen.getByLabelText("Add a section"), "trio");

    expect(screen.getByRole("heading", { level: 3, name: "Editorial" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 3, name: "Heroes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 3, name: "Patterns" })).not.toBeInTheDocument();
  });

  it("inserts the pattern that was clicked", async () => {
    const onInsertPattern = renderWithPatterns();

    await userEvent.click(screen.getByRole("button", { name: /Editorial trio/ }));

    expect(onInsertPattern).toHaveBeenCalledWith("p1");
  });
});
