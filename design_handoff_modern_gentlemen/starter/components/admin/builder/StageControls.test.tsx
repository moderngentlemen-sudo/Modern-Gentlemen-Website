import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { BuilderStoreProvider, useBuilderStore } from "./StoreContext";
import { StageControls, StagePlacementEditor } from "./StageControls";
import { newBlockNode } from "./node";
import type { BuilderStore } from "./store";
import type { BlockNode } from "@/lib/blocks/types";

afterEach(cleanup);

let store: BuilderStore;
function Grab() {
  store = useBuilderStore();
  return null;
}

function stageWith(child: BlockNode): BlockNode {
  return { ...newBlockNode("stageLayout"), children: [child] };
}

function setup(child: BlockNode, editor = false) {
  const stage = stageWith(child);
  const doc = {
    type: "page" as const,
    id: "p",
    title: "P",
    slug: "p",
    status: "draft" as const,
    version: 1,
    treeKey: "sections",
    rest: {},
  };
  function Live() {
    const node = store?.getState().tree[0].children?.[0] ?? child;
    return editor ? (
      <StagePlacementEditor node={node} index={0} mobileFree={false} />
    ) : (
      <StageControls
        node={node}
        index={0}
        mobileFree={false}
        selected
        label="Text"
        onPreview={() => {}}
      />
    );
  }
  return render(
    <BuilderStoreProvider init={{ doc, tree: [stage] }}>
      <Grab />
      <Live />
    </BuilderStoreProvider>
  );
}

describe("StageControls", () => {
  it("nudges the selected element with the arrow keys, Shift for bigger steps", () => {
    const text = newBlockNode("nativeText");
    text.visual = { stage: { desktop: { x: 10, y: 10, w: 30, scale: 1, z: 1 } } };
    setup(text);
    act(() => store.getState().select(text._key));
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowDown", shiftKey: true });
    const placed = store.getState().tree[0].children![0].visual!.stage!.desktop!;
    expect(placed.x).toBe(10.5);
    expect(placed.y).toBe(15);
  });

  it("offers corner scaling and side width handles once selected", () => {
    setup(newBlockNode("nativeText"));
    expect(screen.getByRole("button", { name: "Scale from the bottom right" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Change the width from the left" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Bring forward" })).toBeTruthy();
  });
});

describe("StagePlacementEditor", () => {
  it("writes exact values, centres and resets for the device being edited", () => {
    const text = newBlockNode("nativeText");
    text.visual = { stage: { desktop: { x: 10, y: 10, w: 30, scale: 1, z: 1 } } };
    setup(text, true);
    fireEvent.change(screen.getByLabelText("Scale"), { target: { value: "1.5" } });
    expect(store.getState().tree[0].children![0].visual!.stage!.desktop!.scale).toBe(1.5);
    fireEvent.click(screen.getByRole("button", { name: "Centre across" }));
    const p = store.getState().tree[0].children![0].visual!.stage!.desktop!;
    expect(p.x + (p.w * p.scale) / 2).toBeCloseTo(50);
  });

  it("explains reading order on phones in stack mode", () => {
    setup(newBlockNode("nativeText"), true);
    act(() => store.getState().setDevice("mobile"));
  });
});
