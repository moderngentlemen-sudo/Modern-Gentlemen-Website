import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { EditorExperience, EditorExperienceSwitch, useEditorExperience } from "./EditorExperience";
import { BuilderStoreProvider, useBuilder, useBuilderStore } from "./StoreContext";
import type { BuilderStore } from "./store";
import { newBlockNode } from "./node";
import { resizePlacement } from "./GridControls";
import { gridPlacementSchema } from "@/lib/blocks/grid";

afterEach(cleanup);
let store: BuilderStore;
function Harness() {
  store = useBuilderStore();
  const node = useBuilder((s) => s.tree[0]);
  const { preview, renderNode } = useEditorExperience();
  return (
    <>
      <EditorExperienceSwitch />
      <button onClick={() => preview(["fontFamily"], "google:Lora")}>Hover font</button>
      <button onClick={() => preview([], null)}>Cancel preview</button>
      <output>{String(renderNode(node).settings?.fontFamily ?? "inherited")}</output>
    </>
  );
}
it("keeps original mode and document history intact while previewing and switching", () => {
  const node = newBlockNode("nativeHeading");
  render(
    <BuilderStoreProvider
      init={{
        doc: {
          type: "page",
          id: "p",
          title: "Page",
          slug: "p",
          status: "draft",
          version: 1,
          treeKey: "sections",
          rest: {},
        },
        tree: [node],
      }}
    >
      <EditorExperience>
        <Harness />
      </EditorExperience>
    </BuilderStoreProvider>
  );
  fireEvent.click(screen.getByText("Hover font"));
  expect(screen.getByRole("status")).toHaveTextContent("inherited");
  store.getState().select(node._key);
  fireEvent.click(screen.getByText("Canvas builder · Preview"));
  const baseline = store.getState().payload();
  fireEvent.click(screen.getByText("Hover font"));
  expect(screen.getByRole("status")).toHaveTextContent("google:Lora");
  expect(store.getState().payload()).toEqual(baseline);
  expect(store.getState().past).toHaveLength(0);
  fireEvent.click(screen.getByText("Original builder"));
  expect(screen.getByRole("status")).toHaveTextContent("inherited");
  expect(store.getState().payload()).toEqual(baseline);
});
it("resizes from all sides within grid bounds", () => {
  const start = { column: 3, row: 3, span: 4, rows: 3 };
  expect(resizePlacement(start, 1, 1, "w")).toEqual({ column: 4, row: 3, span: 3, rows: 3 });
  expect(resizePlacement(start, 1, 1, "n")).toEqual({ column: 3, row: 4, span: 4, rows: 2 });
  for (const edge of ["nw", "n", "ne", "e", "se", "s", "sw", "w"]) {
    for (const delta of [-200, 200])
      expect(
        gridPlacementSchema.safeParse(resizePlacement(start, delta, delta, edge)).success
      ).toBe(true);
  }
});
