import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { NativeForm } from "./NativeForm";

const fields = [
  { name: "name", label: "Name", type: "text" as const, required: true },
  { name: "message", label: "Message", type: "textarea" as const },
  { name: "updates", label: "Send updates", type: "checkbox" as const },
];

describe("NativeForm", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("posts configured field values and shows the configured success copy", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetch);
    render(<NativeForm formKey="contact-form" fields={fields} successMessage="Received." />);

    await userEvent.type(screen.getByLabelText(/Name/), "Ada");
    await userEvent.type(screen.getByLabelText("Message"), "Hello");
    await userEvent.click(screen.getByLabelText("Send updates"));
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(fetch).toHaveBeenCalledWith(
      "/api/forms",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"formKey":"contact-form"'),
      })
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Received.");
  });

  it("keeps the form available and exposes an alert when submission fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    render(<NativeForm formKey="contact-form" fields={fields} />);
    await userEvent.type(screen.getByLabelText(/Name/), "Ada");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("could not send");
    expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled();
  });

  it("exposes semantic theme hooks on fields and actions", () => {
    render(<NativeForm formKey="contact-form" fields={fields} />);

    expect(screen.getByLabelText(/Name/)).toHaveClass("mg-form-field");
    expect(screen.getByLabelText("Message")).toHaveClass("mg-form-field");
    expect(screen.getByRole("button", { name: "Submit" })).toHaveClass("mg-button");
  });
});
