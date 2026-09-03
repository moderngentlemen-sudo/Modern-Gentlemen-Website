import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { BlockTree } from "@/lib/blocks/types";

import { SaveSelectionAsPattern, type SaveSelectionAsPatternProps } from "./SaveSelectionAsPattern";
import { BuilderStoreProvider, useBuilder } from "./StoreContext";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const tree: BlockTree = [
  { _key: "first", _type: "sectionHeading", settings: { heading: "First" } },
  { _key: "last", _type: "pullQuote", settings: { quote: "Last" } },
];

function SelectFixture() {
  const select = useBuilder((state) => state.select);
  return (
    <button
      type="button"
      onClick={() => {
        select("last");
        select("first", true);
      }}
    >
      Select fixture
    </button>
  );
}

function renderControl(action: SaveSelectionAsPatternProps["action"]) {
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
      <SelectFixture />
      <SaveSelectionAsPattern action={action} />
    </BuilderStoreProvider>
  );
}

describe("SaveSelectionAsPattern", () => {
  it("stays disabled until the canvas has a selection", async () => {
    const user = userEvent.setup();
    renderControl(vi.fn());

    const save = screen.getByRole("button", { name: "Save selection as pattern" });
    expect(save).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Select fixture" }));
    expect(save).toBeEnabled();
    expect(screen.getByText("2 selected branches will be saved in canvas order.")).toBeVisible();
  });

  it("creates a re-keyed pattern in document order with the selected behavior", async () => {
    const user = userEvent.setup();
    const action = vi.fn<SaveSelectionAsPatternProps["action"]>().mockResolvedValue({
      ok: true,
      data: { id: "pattern-1" },
    });
    renderControl(action);

    await user.click(screen.getByRole("button", { name: "Select fixture" }));
    await user.click(screen.getByRole("button", { name: "Save selection as pattern" }));
    await user.type(screen.getByRole("textbox", { name: "Name" }), "Feature Pair");
    await user.selectOptions(screen.getByRole("combobox", { name: "Behavior" }), "synced");
    await user.click(screen.getByRole("button", { name: "Create pattern" }));

    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    const input = action.mock.calls[0][0];
    expect(input.name).toBe("Feature Pair");
    expect(input.key).toBe("feature-pair");
    expect(input.syncMode).toBe("synced");
    expect(input.blocks.map((block) => block._type)).toEqual(["sectionHeading", "pullQuote"]);
    expect(input.blocks.map((block) => block._key)).not.toContain("first");
    expect(input.blocks.map((block) => block._key)).not.toContain("last");
    expect(refresh).toHaveBeenCalled();
  });
});
