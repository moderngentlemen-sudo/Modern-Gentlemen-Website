import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";

import { BuilderStoreProvider, useBuilderStore } from "./StoreContext";
import { EDITOR_MODE_KEY, EditorExperience, useEditorExperience } from "./EditorExperience";
import { FocusLayout, insertionTarget } from "./FocusEditor";
import { InsertMenu, type BrowseItem } from "./InsertMenu";
import { WidgetLibrary } from "./WidgetLibrary";
import { PatternsProvider } from "./PatternsContext";
import { newBlockNode } from "./node";
import type { BuilderStore } from "./store";
import type { BlockTree } from "@/lib/blocks/types";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const doc = {
  type: "page" as const,
  id: "p",
  title: "Page",
  slug: "p",
  status: "draft" as const,
  version: 1,
  treeKey: "sections" as const,
  rest: {},
};

let store: BuilderStore;
function Grab() {
  store = useBuilderStore();
  return null;
}

function renderFocus(tree: BlockTree, extra?: { browse?: BrowseItem }) {
  return render(
    <BuilderStoreProvider init={{ doc, tree }}>
      <EditorExperience initialMode="focus">
        <Grab />
        <FocusLayout
          isPage
          topBar={<div>Publish bar</div>}
          canvas={
            <div>
              {tree.map((node) => (
                <div key={node._key} data-block-key={node._key}>
                  {node._type}
                </div>
              ))}
            </div>
          }
          insertPane={(onBrowse) => (
            <div>
              <input aria-label="Search sections" />
              <button
                type="button"
                onMouseEnter={() =>
                  onBrowse(extra?.browse ?? { kind: "block", type: "nativeText" })
                }
                onMouseLeave={() => onBrowse(null)}
              >
                Text section
              </button>
            </div>
          )}
          widgetsPane={() => <p>Widgets pane</p>}
          layersPane={<p>Layers pane</p>}
          pagePane={<p>Page pane</p>}
          inspector={<p>Inspector body</p>}
        />
      </EditorExperience>
    </BuilderStoreProvider>
  );
}

describe("insertionTarget", () => {
  const heading = newBlockNode("nativeHeading");
  const text = newBlockNode("nativeText");
  const grid = newBlockNode("gridLayout");
  const tree = [heading, grid, text];

  it("is nothing until something is browsed", () => {
    expect(insertionTarget(tree, heading._key, null)).toBeNull();
  });
  it("lands after the selection, mirroring click-to-insert", () => {
    expect(insertionTarget(tree, heading._key, { kind: "block", type: "nativeText" })).toEqual({
      kind: "after",
      key: heading._key,
    });
  });
  it("lands inside a selected grid for a block", () => {
    expect(insertionTarget(tree, grid._key, { kind: "block", type: "nativeText" })).toEqual({
      kind: "inside",
      key: grid._key,
    });
  });
  it("lands at the end of the page with nothing selected", () => {
    expect(insertionTarget(tree, null, { kind: "pattern", id: "x" })).toEqual({
      kind: "end",
      key: text._key,
    });
    expect(insertionTarget([], null, { kind: "block", type: "nativeText" })).toEqual({
      kind: "end",
      key: null,
    });
  });
  it("never targets inside a locked block", () => {
    const locked = { ...grid, locked: true };
    expect(insertionTarget([locked], locked._key, { kind: "block", type: "nativeText" })).toEqual({
      kind: "after",
      key: locked._key,
    });
  });
});

describe("Focus layout", () => {
  it("opens one pane at a time from the rail and closes it again", () => {
    renderFocus([newBlockNode("nativeHeading")]);
    const rail = screen.getByRole("navigation", { name: "Editor tools" });
    fireEvent.click(within(rail).getByRole("button", { name: "Insert" }));
    expect(screen.getByRole("complementary", { name: "Insert" })).toBeTruthy();
    fireEvent.click(within(rail).getByRole("button", { name: "Layers" }));
    expect(screen.queryByRole("complementary", { name: "Insert" })).toBeNull();
    expect(screen.getByText("Layers pane")).toBeTruthy();
    fireEvent.click(within(rail).getByRole("button", { name: "Layers" }));
    expect(screen.queryByText("Layers pane")).toBeNull();
  });

  it("switches Insert between sections and widgets", () => {
    renderFocus([]);
    fireEvent.click(screen.getByRole("button", { name: "Insert" }));
    fireEvent.click(screen.getByRole("button", { name: "Widgets & elements" }));
    expect(screen.getByText("Widgets pane")).toBeTruthy();
  });

  it("opens Insert with its search focused on /, and the shortcut sheet on ?", () => {
    renderFocus([]);
    vi.useFakeTimers();
    fireEvent.keyDown(window, { key: "/" });
    act(() => void vi.runAllTimers());
    vi.useRealTimers();
    expect(screen.getByRole("complementary", { name: "Insert" })).toBeTruthy();
    fireEvent.keyDown(window, { key: "?" });
    expect(screen.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Keyboard shortcuts" })).toBeNull();
  });

  it("ignores shortcut keys while typing", () => {
    renderFocus([]);
    fireEvent.click(screen.getByRole("button", { name: "Insert" }));
    const input = screen.getByLabelText("Search sections");
    fireEvent.keyDown(input, { key: "?" });
    expect(screen.queryByRole("dialog", { name: "Keyboard shortcuts" })).toBeNull();
  });

  it("shows the insertion point on the canvas while an item is hovered", () => {
    const heading = newBlockNode("nativeHeading");
    const { container } = renderFocus([heading]);
    fireEvent.click(screen.getByRole("button", { name: "Insert" }));
    act(() => store.getState().select(heading._key));
    fireEvent.mouseEnter(screen.getByText("Text section"));
    const marker = container.querySelector("[data-insertion-marker]");
    expect(marker?.textContent).toMatch(/Inserts after/);
    fireEvent.mouseLeave(screen.getByText("Text section"));
    expect(container.querySelector("[data-insertion-marker]")).toBeNull();
  });

  it("floats the inspector beside the selection, and docks it on request", () => {
    const heading = newBlockNode("nativeHeading");
    const { container } = renderFocus([heading]);
    expect(screen.queryByText("Inspector body")).toBeNull();
    act(() => store.getState().select(heading._key));
    expect(container.querySelector(`[data-floating-inspector="${heading._key}"]`)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Dock" }));
    expect(container.querySelector("[data-floating-inspector]")).toBeNull();
    expect(screen.getByText("Inspector body")).toBeTruthy();
    expect(window.localStorage.getItem("mg-focus-inspector")).toBe("dock");
    fireEvent.click(screen.getByRole("button", { name: "Close inspector" }));
    expect(store.getState().selectedKey).toBeNull();
  });

  it("counts issues on the rail and lists them in Health", () => {
    const heading = newBlockNode("nativeHeading");
    renderFocus([heading]);
    act(() =>
      store
        .getState()
        .setServerIssues([
          { key: heading._key, type: "nativeHeading", path: "text", message: "Required" },
        ])
    );
    const health = screen.getByRole("button", { name: "Health, 1 issue" });
    fireEvent.click(health);
    const pane = screen.getByRole("complementary", { name: "Health" });
    fireEvent.click(within(pane).getByRole("button", { name: /Required/ }));
    expect(store.getState().selectedKey).toBe(heading._key);
  });

  it("offers the three editor layouts from the rail", () => {
    renderFocus([]);
    fireEvent.click(screen.getByRole("button", { name: "Editor layout" }));
    const dialog = screen.getByRole("dialog", { name: "Editor layout" });
    expect(within(dialog).getByRole("button", { name: "Focus" }).getAttribute("aria-pressed")).toBe(
      "true"
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Original builder" }));
    expect(window.localStorage.getItem(EDITOR_MODE_KEY)).toBe("original");
  });
});

describe("Editor mode", () => {
  function Mode() {
    const { mode, modern } = useEditorExperience();
    return <output>{`${mode}:${modern}`}</output>;
  }
  beforeEach(() => window.localStorage.clear());

  it("defaults to Focus, which keeps every Canvas Preview capability", () => {
    render(
      <BuilderStoreProvider init={{ doc, tree: [] }}>
        <EditorExperience>
          <Mode />
        </EditorExperience>
      </BuilderStoreProvider>
    );
    expect(screen.getByRole("status").textContent).toBe("focus:true");
  });
  it("restores the browser's saved choice", () => {
    window.localStorage.setItem(EDITOR_MODE_KEY, "original");
    render(
      <BuilderStoreProvider init={{ doc, tree: [] }}>
        <EditorExperience>
          <Mode />
        </EditorExperience>
      </BuilderStoreProvider>
    );
    expect(screen.getByRole("status").textContent).toBe("original:false");
  });
});

describe("Hover previews while browsing", () => {
  it("previews a saved pattern's blocks and reports what is browsed", () => {
    const blocks = [newBlockNode("nativeHeading"), newBlockNode("nativeText")];
    const onBrowse = vi.fn();
    const { container } = render(
      <DndContext>
        <PatternsProvider
          patterns={[
            {
              id: "pat",
              name: "Story trio",
              description: "Heading and text",
              blockCount: 2,
              blocks,
              syncMode: "detachable",
              published: true,
            },
          ]}
        >
          <InsertMenu
            onInsert={() => {}}
            onInsertPattern={() => {}}
            onBrowse={onBrowse}
            patterns={[
              { id: "pat", name: "Story trio", description: "Heading and text", blockCount: 2 },
            ]}
          />
        </PatternsProvider>
      </DndContext>
    );
    fireEvent.mouseEnter(screen.getByRole("button", { name: /Story trio/ }));
    expect(container.querySelector('[data-pattern-preview="pat"]')).toBeTruthy();
    expect(onBrowse).toHaveBeenLastCalledWith({ kind: "pattern", id: "pat" });
    fireEvent.mouseLeave(screen.getByRole("button", { name: /Story trio/ }));
    expect(container.querySelector("[data-pattern-preview]")).toBeNull();
    expect(onBrowse).toHaveBeenLastCalledWith(null);
  });

  it("previews a widget on hover and on keyboard focus", () => {
    const onBrowse = vi.fn();
    const { container } = render(
      <BuilderStoreProvider init={{ doc, tree: [] }}>
        <WidgetLibrary onBrowse={onBrowse} />
      </BuilderStoreProvider>
    );
    const first = container.querySelector("button")!;
    fireEvent.focus(first);
    expect(container.querySelector("[data-widget-preview]")).toBeTruthy();
    expect(onBrowse.mock.calls.at(-1)?.[0]).toMatchObject({ kind: "widget" });
    fireEvent.blur(first);
    expect(container.querySelector("[data-widget-preview]")).toBeNull();
  });
});
