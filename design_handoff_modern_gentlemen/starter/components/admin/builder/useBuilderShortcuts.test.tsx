import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { BlockTree } from "@/lib/blocks/types";

import { BuilderStoreProvider, useBuilder } from "./StoreContext";
import { useBuilderShortcuts } from "./useBuilderShortcuts";

const tree: BlockTree = [
  { _key: "first", _type: "sectionHeading" },
  { _key: "last", _type: "pullQuote" },
];

function Harness() {
  useBuilderShortcuts();
  const selectedKeys = useBuilder((state) => state.selectedKeys);
  const length = useBuilder((state) => state.tree.length);
  const select = useBuilder((state) => state.select);

  return (
    <>
      <output aria-label="Selection">{selectedKeys.join(",")}</output>
      <output aria-label="Tree length">{length}</output>
      <button type="button" onClick={() => select("first")}>
        Select first
      </button>
      <input aria-label="Editable field" defaultValue="Copy" />
      <div role="dialog" aria-label="Open dialog">
        <button type="button">Dialog control</button>
      </div>
    </>
  );
}

function renderHarness() {
  return render(
    <BuilderStoreProvider
      init={{
        doc: {
          type: "page",
          id: "page-1",
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
      <Harness />
    </BuilderStoreProvider>
  );
}

describe("useBuilderShortcuts", () => {
  it("supports select all, duplicate, undo, redo, delete and clear selection", async () => {
    const user = userEvent.setup();
    renderHarness();

    fireEvent.keyDown(document, { key: "a", ctrlKey: true });
    expect(screen.getByLabelText("Selection")).toHaveTextContent("first,last");

    fireEvent.keyDown(document, { key: "d", ctrlKey: true });
    expect(screen.getByLabelText("Tree length")).toHaveTextContent("4");

    fireEvent.keyDown(document, { key: "z", ctrlKey: true });
    expect(screen.getByLabelText("Tree length")).toHaveTextContent("2");

    fireEvent.keyDown(document, { key: "y", ctrlKey: true });
    expect(screen.getByLabelText("Tree length")).toHaveTextContent("4");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByLabelText("Selection")).toBeEmptyDOMElement();

    await user.click(screen.getByRole("button", { name: "Select first" }));
    fireEvent.keyDown(document, { key: "Delete" });
    expect(screen.getByLabelText("Tree length")).toHaveTextContent("3");
  });

  it("leaves native editing and dialog keystrokes alone", async () => {
    const user = userEvent.setup();
    renderHarness();
    const input = screen.getByRole("textbox", { name: "Editable field" });

    await user.click(input);
    fireEvent.keyDown(input, { key: "a", ctrlKey: true });
    expect(screen.getByLabelText("Selection")).toBeEmptyDOMElement();

    await user.click(screen.getByRole("button", { name: "Select first" }));
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(screen.getByLabelText("Tree length")).toHaveTextContent("2");

    fireEvent.keyDown(screen.getByRole("button", { name: "Dialog control" }), {
      key: "a",
      ctrlKey: true,
    });
    expect(screen.getByLabelText("Selection")).toHaveTextContent("first");
  });
});
