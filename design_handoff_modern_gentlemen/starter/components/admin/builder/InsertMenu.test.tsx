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
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";

import { manifestFor } from "@/lib/blocks/manifests";

import { InsertMenu } from "./InsertMenu";

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
