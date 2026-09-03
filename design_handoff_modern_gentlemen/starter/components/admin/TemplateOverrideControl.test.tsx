import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TemplateOverrideControl } from "./TemplateOverrideControl";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const state = {
  explicitTemplateId: "feature",
  inheritedTemplate: { id: "default", name: "Editorial default" },
  options: [
    { id: "default", name: "Editorial default", status: "published" },
    { id: "feature", name: "Feature frame", status: "draft" },
  ],
};

describe("TemplateOverrideControl", () => {
  it("names inheritance and saves a record-specific override", async () => {
    const action = vi.fn().mockResolvedValue({ ok: true, data: undefined });
    render(<TemplateOverrideControl id="article-1" noun="article" state={state} action={action} />);

    await userEvent.click(screen.getByRole("button", { name: "Layout" }));
    expect(screen.getByRole("option", { name: "Inherit — Editorial default" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Feature frame — draft" })).toBeTruthy();

    await userEvent.selectOptions(screen.getByLabelText("Template override"), "default");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(action).toHaveBeenCalledWith({ id: "article-1", templateId: "default" })
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("restores inheritance with a null override", async () => {
    const action = vi.fn().mockResolvedValue({ ok: true, data: undefined });
    render(<TemplateOverrideControl id="page-1" noun="page" state={state} action={action} />);

    await userEvent.click(screen.getByRole("button", { name: "Layout" }));
    await userEvent.selectOptions(screen.getByLabelText("Template override"), "");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(action).toHaveBeenCalledWith({ id: "page-1", templateId: null }));
  });

  it("keeps a service error in the open dialog", async () => {
    const action = vi.fn().mockResolvedValue({ ok: false, error: "Template is unavailable" });
    render(<TemplateOverrideControl id="page-1" noun="page" state={state} action={action} />);

    await userEvent.click(screen.getByRole("button", { name: "Layout" }));
    await userEvent.selectOptions(screen.getByLabelText("Template override"), "default");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Template is unavailable")).toBeVisible();
    expect(screen.getByRole("dialog")).toBeVisible();
  });

  it("does not submit a draft template that the public renderer would ignore", async () => {
    const action = vi.fn();
    render(<TemplateOverrideControl id="page-1" noun="page" state={state} action={action} />);

    await userEvent.click(screen.getByRole("button", { name: "Layout" }));

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByText(/Publish this template before assigning it/)).toBeVisible();
  });
});
