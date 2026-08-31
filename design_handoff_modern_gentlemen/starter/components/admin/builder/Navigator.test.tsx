import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { BlockTree } from "@/lib/blocks/types";

import { BuilderStoreProvider } from "./StoreContext";
import { Navigator } from "./Navigator";

function renderNavigator(tree: BlockTree) {
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
      <Navigator />
    </BuilderStoreProvider>
  );
}

const nested: BlockTree = [
  {
    _key: "container",
    _type: "layoutContainer",
    children: [
      {
        _key: "stack",
        _type: "stack",
        children: [{ _key: "quote", _type: "pullQuote" }],
      },
    ],
  },
];

describe("Navigator", () => {
  it("shows every level of a nested document hierarchy", () => {
    renderNavigator(nested);

    expect(screen.getByRole("button", { name: "Container" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stack" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pull quote" })).toBeInTheDocument();
  });

  it("selects an exact nested block", async () => {
    renderNavigator(nested);

    const quote = screen.getByRole("button", { name: "Pull quote" });
    await userEvent.click(quote);

    expect(quote).toHaveAttribute("aria-current", "true");
  });

  it("adds a second selection with the platform modifier", async () => {
    renderNavigator(nested);
    const container = screen.getByRole("button", { name: "Container" });
    const quote = screen.getByRole("button", { name: "Pull quote" });
    await userEvent.click(container);
    fireEvent.click(quote, { shiftKey: true });
    expect(container.closest("li")).toHaveAttribute("aria-selected", "true");
    expect(quote.closest("li")).toHaveAttribute("aria-selected", "true");
  });

  it("collapses and expands a container without changing the document", async () => {
    renderNavigator(nested);

    await userEvent.click(screen.getByRole("button", { name: "Collapse Container" }));
    expect(screen.queryByRole("button", { name: "Stack" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Expand Container" }));
    expect(screen.getByRole("button", { name: "Stack" })).toBeInTheDocument();
  });

  it("marks hidden and locked nodes", () => {
    renderNavigator([
      {
        _key: "quote",
        _type: "pullQuote",
        visibility: { hidden: true },
        locked: true,
      },
    ]);

    expect(screen.getByText("Hidden")).toBeInTheDocument();
    expect(screen.getByLabelText("Locked")).toBeInTheDocument();
  });
});
