/**
 * Guards the two locator traps that cost a CI round on this screen.
 *
 * The E2E spec for `/admin/password` cannot run in a fresh container — the
 * signed-in specs need an admin account, and `scripts/create-admin.ts` needs a
 * service-role key. So the assumptions those specs make about *this* markup are
 * asserted here instead, where they run on every save. Both traps below were
 * real failures, not hypotheticals.
 *
 * ⚠️ Note the query style. Testing Library's `getByLabelText` matches a label's
 * **text content**, which includes the `aria-hidden` required asterisk;
 * Playwright's `getByLabel` matches the **accessible name**, which does not. So
 * a test written with `getByLabelText("New password", { exact: true })` fails
 * here while the Playwright locator it is meant to guard succeeds. Accessible
 * names are asserted explicitly below, because those are what the spec sees.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider } from "@/components/admin/ui/Toast";

import { PasswordForm } from "./PasswordForm";

// The action is a "use server" module reaching for cookies; the markup is what
// is under test here.
vi.mock("./actions", () => ({
  changePasswordAction: vi.fn(async () => ({ ok: true, data: undefined })),
}));

function renderForm() {
  render(
    <ToastProvider>
      <PasswordForm />
    </ToastProvider>
  );

  // Both password fields, in document order. `type="password"` carries no
  // implicit ARIA role, so there is no `getByRole` route to them.
  const fields = screen.getAllByLabelText(/new password/i);
  return { next: fields[0], confirm: fields[1], fields };
}

describe("the field labels", () => {
  it("names each field exactly, with the required asterisk excluded", () => {
    const { next, confirm } = renderForm();

    // `FieldShell` marks the asterisk aria-hidden for exactly this reason — CI
    // once found a field named `Quote *`.
    expect(next).toHaveAccessibleName("New password");
    expect(confirm).toHaveAccessibleName("Confirm new password");
  });

  it("⚠️ needs `exact`, because a loose match hits both fields", () => {
    const { fields } = renderForm();

    // The trap: "Confirm new password" *contains* "new password", so
    // Playwright's substring-by-default `getByLabel` matched two elements and
    // failed strict mode rather than taking the first. This asserts the
    // ambiguity is real, so nobody "simplifies" the `exact: true` out of the spec.
    expect(fields).toHaveLength(2);
  });

  it("masks both fields", () => {
    const { next, confirm } = renderForm();

    expect(next).toHaveAttribute("type", "password");
    expect(confirm).toHaveAttribute("type", "password");
  });
});

describe("the validation sentence", () => {
  it("⚠️ is distinct from the help text, which also says 'at least 12 characters'", async () => {
    const { next, confirm } = renderForm();

    await userEvent.type(next, "short");
    await userEvent.type(confirm, "short");

    // The second trap: the field's own help reads "At least 12 characters, and
    // under 72 bytes…", so a loose /at least 12 characters/i matches the help
    // *and* the error. The full sentence is what the spec must assert.
    expect(screen.getAllByText(/at least 12 characters/i).length).toBeGreaterThan(1);
    expect(screen.getByText("Use at least 12 characters.")).toBeInTheDocument();
  });

  it("reports a mismatch with the sentence the spec waits for", async () => {
    const { next, confirm } = renderForm();

    await userEvent.type(next, "correct horse battery staple");
    await userEvent.type(confirm, "correct horse battery stapl");

    expect(screen.getByText("Those two passwords do not match.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update password" })).toBeDisabled();
  });
});
