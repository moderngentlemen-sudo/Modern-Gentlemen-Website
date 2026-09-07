import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { BuilderStoreProvider, useBuilderStore } from "../builder/StoreContext";
import type { BuilderStore } from "../builder/store";
import { V2Library } from "./V2Library";
afterEach(cleanup);
let store: BuilderStore;
function Harness() {
  store = useBuilderStore();
  return <V2Library patterns={[]} />;
}
function setup() {
  render(
    <BuilderStoreProvider
      init={{
        doc: {
          type: "page",
          id: "v2",
          title: "V2",
          slug: "v2",
          status: "draft",
          version: 1,
          treeKey: "sections",
          rest: { custom: { retained: true } },
        },
        tree: [{ _key: "container", _type: "stack", children: [] }],
      }}
    >
      <Harness />
    </BuilderStoreProvider>
  );
}
it("opening the V2 library never converts or dirties a document", () => {
  setup();
  expect(store.getState().dirty).toBe(false);
  expect(store.getState().payload()).toMatchObject({
    custom: { retained: true },
    sections: [{ _key: "container", _type: "stack", children: [] }],
  });
});
it("inserts into the selected slot and preserves independent undo", () => {
  setup();
  store.getState().select("container");
  fireEvent.change(screen.getByLabelText("Find elements"), { target: { value: "Heading" } });
  const heading = screen.getAllByRole("button").find((b) => b.textContent?.startsWith("Heading"))!;
  fireEvent.click(heading);
  expect(store.getState().tree[0].children?.[0]._type).toBe("nativeHeading");
  store.getState().undo();
  expect(store.getState().tree[0].children).toHaveLength(0);
});
