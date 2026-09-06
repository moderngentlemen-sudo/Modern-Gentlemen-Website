import { afterEach, describe, it, expect, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GridControls } from "./GridControls";
import { BuilderStoreProvider, useBuilder, useBuilderStore } from "./StoreContext";
import { newBlockNode } from "./node";
import type { BuilderStore } from "./store";
let store: BuilderStore;
const preview = vi.fn();
function Harness() {
  store = useBuilderStore();
  const node = useBuilder((s) => s.tree[0]);
  return (
    <div
      data-grid-layout=""
      style={{ columnGap: 0, rowGap: 0, gridTemplateRows: "48px 48px 48px" }}
    >
      <div data-block-key={node._key}>
        <GridControls node={node} onPreview={preview} />
      </div>
    </div>
  );
}
function setup() {
  const node = newBlockNode("nativeHeading");
  node.visual = { grid: { desktop: { column: 1, row: 1, span: 6, rows: 1 } } };
  render(
    <BuilderStoreProvider
      init={{
        doc: {
          type: "page",
          id: "p",
          title: "Grid",
          slug: "grid",
          status: "draft",
          version: 1,
          treeKey: "sections",
          rest: {},
        },
        tree: [node],
      }}
    >
      <Harness />
    </BuilderStoreProvider>
  );
  const grid = document.querySelector<HTMLElement>("[data-grid-layout]")!;
  Object.defineProperty(grid, "offsetWidth", { value: 600 });
  vi.spyOn(grid, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 600,
    bottom: 144,
    width: 600,
    height: 144,
    toJSON() {},
  });
  const frame = document.querySelector<HTMLElement>("[data-block-key]")!;
  vi.spyOn(frame, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 300,
    bottom: 48,
    width: 300,
    height: 48,
    toJSON() {},
  });
  class TestPointerEvent extends MouseEvent {
    pointerId: number;
    constructor(type: string, options: PointerEventInit = {}) {
      super(type, options);
      this.pointerId = options.pointerId ?? 1;
    }
  }
  vi.stubGlobal("PointerEvent", TestPointerEvent);
  for (const b of screen.getAllByRole("button")) {
    Object.defineProperty(b, "setPointerCapture", { value: vi.fn() });
    Object.defineProperty(b, "hasPointerCapture", { value: () => true });
    Object.defineProperty(b, "releasePointerCapture", { value: vi.fn() });
  }
  return node._key;
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  preview.mockClear();
});
describe("grid gestures", () => {
  it("previews without dirtying the document and commits one undo step on release", () => {
    setup();
    const b = screen.getByRole("button", { name: "Resize grid element" });
    fireEvent.pointerDown(b, { pointerId: 1, button: 0, clientX: 100, clientY: 20 });
    fireEvent.pointerMove(b, { pointerId: 1, clientX: 150, clientY: 68 });
    fireEvent.pointerMove(b, { pointerId: 1, clientX: 200, clientY: 68 });
    expect(store.getState().dirty).toBe(false);
    expect(preview).toHaveBeenLastCalledWith({ column: 1, row: 1, span: 8, rows: 2 });
    fireEvent.pointerUp(b, { pointerId: 1 });
    expect(store.getState().past).toHaveLength(1);
    expect(store.getState().tree[0].visual?.grid?.desktop).toEqual({
      column: 1,
      row: 1,
      span: 8,
      rows: 2,
    });
    act(() => store.getState().undo());
    expect(store.getState().tree[0].visual?.grid?.desktop?.span).toBe(6);
  });
  it("Escape and pointer cancellation discard previews without saving", () => {
    setup();
    const b = screen.getByRole("button", { name: "Move grid element" });
    for (const escape of [false, true]) {
      fireEvent.pointerDown(b, { pointerId: 1, button: 0, clientX: 100, clientY: 20 });
      fireEvent.pointerMove(b, { pointerId: 1, clientX: 150, clientY: 68 });
      if (escape) {
        fireEvent.keyDown(b, { key: "Escape" });
        fireEvent.pointerUp(b, { pointerId: 1 });
      } else fireEvent.pointerCancel(b, { pointerId: 1 });
      expect(store.getState().dirty).toBe(false);
      expect(preview).toHaveBeenLastCalledWith(null);
    }
  });
  it("supports keyboard movement and ignores locked writes", () => {
    const key = setup(),
      b = screen.getByRole("button", { name: "Move grid element" });
    fireEvent.keyDown(b, { key: "ArrowRight" });
    expect(store.getState().tree[0].visual?.grid?.desktop?.column).toBe(2);
    act(() => store.getState().setLocked(key, true));
    fireEvent.keyDown(b, { key: "ArrowDown" });
    expect(store.getState().tree[0].visual?.grid?.desktop?.row).toBe(1);
  });
});
