import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ set: vi.fn(), refresh: vi.fn(), toast: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh, push: vi.fn() }),
}));
vi.mock("./actions", () => ({
  setHomepageAction: mocks.set,
  createPageAction: vi.fn(),
  deletePageAction: vi.fn(),
  duplicatePageAction: vi.fn(),
}));
vi.mock("@/components/admin/ui/Toast", () => ({ useToast: () => ({ push: mocks.toast }) }));
vi.mock("@/components/admin/builder/StudioDesignPicker", () => ({
  StudioDesignPicker: () => null,
}));
import { PagesList, type PageRow } from "./PagesList";
const pages: PageRow[] = [
  {
    id: "home",
    title: "Original home",
    slug: "home",
    status: "published",
    version: 1,
    updated_at: "",
  },
  {
    id: "launch",
    title: "New landing",
    slug: "launch",
    status: "published",
    version: 1,
    updated_at: "",
  },
  {
    id: "draft",
    title: "Working draft",
    slug: "draft",
    status: "draft",
    version: 0,
    updated_at: "",
  },
];
beforeEach(() => {
  vi.resetAllMocks();
  mocks.set.mockResolvedValue({ ok: true });
});
function setup(canSetHomepage = true) {
  render(
    <PagesList pages={pages} canWrite canDelete homepageId="home" canSetHomepage={canSetHomepage} />
  );
}
it("marks the homepage, disables its deletion, and only enables published alternatives", () => {
  setup();
  const home = screen.getByRole("row", { name: /Original home/ });
  expect(within(home).getByText("Homepage")).toBeVisible();
  expect(within(home).getByRole("button", { name: "Delete" })).toBeDisabled();
  expect(
    within(screen.getByRole("row", { name: /Working draft/ })).getByRole("button", {
      name: "Set as homepage",
    })
  ).toBeDisabled();
  expect(
    within(screen.getByRole("row", { name: /New landing/ })).getByRole("button", {
      name: "Set as homepage",
    })
  ).toBeEnabled();
});
it("hides the option when the editor cannot publish pages", () => {
  setup(false);
  expect(screen.queryByRole("button", { name: "Set as homepage" })).not.toBeInTheDocument();
});
it("confirms the chosen page and refreshes the list after success", async () => {
  setup();
  const user = userEvent.setup();
  await user.click(
    within(screen.getByRole("row", { name: /New landing/ })).getByRole("button", {
      name: "Set as homepage",
    })
  );
  expect(mocks.set).not.toHaveBeenCalled();
  const dialog = screen.getByRole("dialog");
  expect(dialog).toHaveTextContent("changes the live homepage immediately");
  await user.click(within(dialog).getByRole("button", { name: "Set homepage" }));
  await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  expect(mocks.set).toHaveBeenCalledWith({ id: "launch" });
});
it("keeps the dialog and existing selection when the server refuses the change", async () => {
  mocks.set.mockResolvedValue({ ok: false, error: "Publish this page first." });
  setup();
  const user = userEvent.setup();
  await user.click(
    within(screen.getByRole("row", { name: /New landing/ })).getByRole("button", {
      name: "Set as homepage",
    })
  );
  await user.click(screen.getByRole("button", { name: "Set homepage" }));
  await waitFor(() =>
    expect(mocks.toast).toHaveBeenCalledWith("Publish this page first.", "error")
  );
  expect(screen.getByRole("dialog")).toBeVisible();
  expect(mocks.refresh).not.toHaveBeenCalled();
});
