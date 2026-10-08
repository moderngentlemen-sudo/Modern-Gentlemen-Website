import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";

import { BuilderStoreProvider, useBuilderStore } from "./StoreContext";
import { EDITOR_MODE_KEY, EditorExperience, useEditorExperience } from "./EditorExperience";
import { FocusLayout, insertionTarget } from "./FocusEditor";
import { CompareDevices, rankCommands, type FocusCommand } from "./FocusTools";
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

function renderFocus(tree: BlockTree, extra?: { browse?: BrowseItem; commands?: FocusCommand[] }) {
  return render(
    <BuilderStoreProvider init={{ doc, tree }}>
      <EditorExperience initialMode="focus">
        <Grab />
        <FocusLayout
          isPage
          commands={extra?.commands}
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

describe("Command bar", () => {
  const command = (label: string, group = "Edit"): FocusCommand => ({
    id: label,
    label,
    group,
    run: () => {},
  });

  it("ranks label prefixes first and needs every word to match", () => {
    const list = [command("Zoom to 100%", "View"), command("Open Insert"), command("Insert Text")];
    expect(rankCommands(list, "ins").map((c) => c.label)).toEqual(["Insert Text", "Open Insert"]);
    expect(rankCommands(list, "insert text").map((c) => c.label)).toEqual(["Insert Text"]);
    expect(rankCommands(list, "")).toHaveLength(3);
  });

  it("opens on Ctrl/⌘K and runs the highlighted command on Enter", () => {
    renderFocus([newBlockNode("nativeHeading")]);
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const input = screen.getByRole("combobox", { name: "Search commands" });
    fireEvent.change(input, { target: { value: "preview mobile" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(store.getState().device).toBe("mobile");
    expect(screen.queryByRole("dialog", { name: "Command bar" })).toBeNull();
  });

  it("previews while highlighting: outlines a block, marks an insertion point", () => {
    const heading = newBlockNode("nativeHeading");
    const insert: FocusCommand = {
      id: "insert:text",
      label: "Insert Text",
      group: "Insert",
      browse: { kind: "block", type: "nativeText" },
      run: () => {},
    };
    const { container } = renderFocus([heading], { commands: [insert] });
    fireEvent.click(screen.getByRole("button", { name: "Command bar" }));
    const input = screen.getByRole("combobox", { name: "Search commands" });
    fireEvent.change(input, { target: { value: "heading" } });
    expect(store.getState().hoveredKey).toBe(heading._key);
    fireEvent.change(input, { target: { value: "insert text" } });
    expect(container.querySelector("[data-insertion-marker]")).toBeTruthy();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(container.querySelector("[data-insertion-marker]")).toBeNull();
    expect(store.getState().hoveredKey).toBeNull();
  });

  it("goes to a block by a piece of its copy", () => {
    const text = { ...newBlockNode("nativeText"), settings: { content: "Autumn tailoring" } };
    renderFocus([newBlockNode("nativeHeading"), text]);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    const input = screen.getByRole("combobox", { name: "Search commands" });
    fireEvent.change(input, { target: { value: "autumn" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(store.getState().selectedKey).toBe(text._key);
  });
});

describe("History pane", () => {
  it("lists steps in words and travels back and forward", () => {
    renderFocus([]);
    act(() => store.getState().insert("nativeHeading"));
    act(() => store.getState().insert("nativeText"));
    fireEvent.click(screen.getByRole("button", { name: "History" }));
    const list = screen.getByRole("list", { name: "Edit history" });
    expect(within(list).getByText("Added Text")).toBeTruthy();
    fireEvent.click(within(list).getByText("Where this session began"));
    expect(store.getState().tree).toHaveLength(0);
    expect(store.getState().future).toHaveLength(2);
    fireEvent.click(within(list).getByText("Added Text"));
    expect(store.getState().tree).toHaveLength(2);
  });

  it("names a checkpoint", () => {
    renderFocus([]);
    act(() => store.getState().insert("nativeHeading"));
    fireEvent.click(screen.getByRole("button", { name: "History" }));
    fireEvent.click(screen.getByRole("button", { name: "Name this point" }));
    fireEvent.change(screen.getByLabelText("Checkpoint name"), {
      target: { value: "First draft" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText(/First draft/)).toBeTruthy();
  });
});

describe("Selection bar", () => {
  it("appears for two or more blocks and acts on all of them in one step", () => {
    const a = newBlockNode("nativeHeading");
    const b = newBlockNode("nativeText");
    renderFocus([a, b]);
    expect(screen.queryByRole("toolbar")).toBeNull();
    act(() => {
      store.getState().select(a._key);
      store.getState().select(b._key, true);
    });
    const bar = screen.getByRole("toolbar", { name: "2 blocks selected" });
    const before = store.getState().past.length;
    fireEvent.click(within(bar).getByRole("button", { name: "Hide" }));
    expect(store.getState().tree.every((node) => node.visibility?.hidden)).toBe(true);
    expect(store.getState().past.length).toBe(before + 1);
    fireEvent.click(within(bar).getByRole("button", { name: "Lock" }));
    expect(store.getState().tree.every((node) => node.locked)).toBe(true);
    const sideBySide = within(bar).getByRole("button", { name: "Side by side" });
    expect((sideBySide as HTMLButtonElement).disabled).toBe(true);
    expect(sideBySide.getAttribute("title")).toMatch(/Unlock/);
    fireEvent.click(within(bar).getByRole("button", { name: "Clear" }));
    expect(screen.queryByRole("toolbar")).toBeNull();
  });
});

describe("Health suggestions", () => {
  it("lists non-blocking advice and applies its one-click fix", () => {
    const text = { ...newBlockNode("nativeText"), visibility: { devices: [] } };
    renderFocus([text]);
    fireEvent.click(screen.getByRole("button", { name: "Health" }));
    const section = screen.getByRole("region", { name: "Suggestions" });
    fireEvent.click(within(section).getByRole("button", { name: "Show on all devices" }));
    expect(store.getState().tree[0].visibility?.devices).toBeUndefined();
    expect(screen.queryByRole("region", { name: "Suggestions" })).toBeNull();
  });
});

describe("Compare devices", () => {
  it("waits for autosave, then frames one preview link at three widths", async () => {
    const mint = vi.fn(async () => ({ ok: true, data: { path: "/preview/abc" } }));
    render(
      <BuilderStoreProvider init={{ doc, tree: [] }}>
        <Grab />
        <CompareDevices mintPreview={mint} onClose={() => {}} />
      </BuilderStoreProvider>
    );
    await waitFor(() => expect(mint).toHaveBeenCalledTimes(1));
    const frames = await screen.findAllByTitle(/preview$/);
    expect(frames.map((f) => f.getAttribute("src"))).toEqual([
      "/preview/abc",
      "/preview/abc",
      "/preview/abc",
    ]);

    act(() => store.getState().insert("nativeHeading"));
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(screen.getByRole("status").textContent).toMatch(/Saving/);
    expect(mint).toHaveBeenCalledTimes(1);
    act(() => {
      const state = store.getState();
      state.markSaving();
      state.markSaved(state.tree, state.doc.rest);
    });
    await waitFor(() => expect(mint).toHaveBeenCalledTimes(2));
  });

  it("is offered on the rail only when previews can be minted", () => {
    renderFocus([]);
    expect(screen.queryByRole("button", { name: "Compare devices" })).toBeNull();
  });
});

describe("Side by side", () => {
  it("wraps two selected blocks into one Columns row as one undo step", () => {
    const a = newBlockNode("nativeHeading");
    const b = newBlockNode("nativeText");
    renderFocus([a, b]);
    act(() => {
      store.getState().select(a._key);
      store.getState().select(b._key, true);
    });
    fireEvent.click(screen.getByRole("button", { name: "Side by side" }));
    const tree = store.getState().tree;
    expect(tree).toHaveLength(1);
    expect(tree[0]._type).toBe("columns");
    expect(store.getState().selectedKey).toBe(tree[0]._key);
    act(() => store.getState().undo());
    expect(store.getState().tree.map((n) => n._key)).toEqual([a._key, b._key]);
  });
});
