import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DuplicateDocumentDialog } from "./DuplicateDocumentDialog";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

describe("DuplicateDocumentDialog", () => {
  it("creates a separately named draft and opens its editor", async () => {
    const user = userEvent.setup();
    const action = vi.fn().mockResolvedValue({ ok: true, data: { id: "copy-id" } });
    render(
      <DuplicateDocumentDialog
        source={{ id: "source-id", title: "Homepage", slug: "home" }}
        noun="page"
        slugNoun="slug"
        action={action}
        destination={(id) => `/admin/pages/${id}`}
        onClose={() => {}}
      />
    );

    const title = screen.getByRole("textbox", { name: "Title" });
    const slug = screen.getByRole("textbox", { name: "Slug" });
    expect(title).toHaveValue("Homepage copy");
    expect(slug).toHaveValue("home-copy");

    await user.clear(title);
    await user.type(title, "Campaign landing");
    expect(slug).toHaveValue("campaign-landing");
    await user.click(screen.getByRole("button", { name: "Duplicate" }));

    await waitFor(() =>
      expect(action).toHaveBeenCalledWith({
        id: "source-id",
        title: "Campaign landing",
        slug: "campaign-landing",
      })
    );
    expect(push).toHaveBeenCalledWith("/admin/pages/copy-id");
  });

  it("keeps a uniqueness error in the dialog", async () => {
    const user = userEvent.setup();
    const action = vi.fn().mockResolvedValue({ ok: false, error: "That key is already in use" });
    render(
      <DuplicateDocumentDialog
        source={{ id: "source-id", title: "Feature", slug: "feature" }}
        noun="pattern"
        slugNoun="key"
        action={action}
        destination={(id) => `/admin/patterns/${id}`}
        onClose={() => {}}
      />
    );

    await user.click(screen.getByRole("button", { name: "Duplicate" }));
    expect(await screen.findByText("That key is already in use")).toBeVisible();
  });
});
