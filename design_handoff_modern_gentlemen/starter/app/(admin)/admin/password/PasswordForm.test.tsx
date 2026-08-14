/**
 * Guards the two locator traps that cost a CI round on this screen.
 *
 * The E2E spec for `/admin/password` cannot run in a fresh container — the
 * signed-in specs need an admin account, and `scripts/create-admin.ts` needs a
 * service-role key. So the assumptions those specs make about *this* markup are
 * asserted here instead, where they run on every save. Both traps below were
 * real failures, not hypotheticals.
 *
 * ⚠️ **Label text, not accessible name — and an earlier version of this file got
 * that backwards.** `FieldShell` appends the required asterisk inside an
 * `aria-hidden` span, so the two differ: the accessible name is
 * "New password", the label's rendered text is "New password *". This file
 * originally asserted `toHaveAccessibleName`, on the theory that Playwright's
 * `getByLabel` computes accessible names. **CI disproved that** —
 * `getByLabel("New password", { exact: true })` matched *zero* elements against
 * this markup, which only happens if the asterisk is part of what Playwright
 * compares.
 *
 * So the queries below mirror Playwright's actual behaviour, which is also
 * Testing Library's: match the label's text content, asterisk included. A guard
 * that asserts the wrong property is worse than none, because it reads as
 * covered.
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
  it("⚠️ is ambiguous under a loose match — both fields answer to 'new password'", () => {
    const { fields } = renderForm();

    // Trap one: "Confirm new password" *contains* "new password", so
    // Playwright's substring-by-default getByLabel matched two elements and
    // failed strict mode rather than taking the first.
    expect(fields).toHaveLength(2);
  });

  it("⚠️ carries the required asterisk in its label text, so an exact string matches nothing", () => {
    renderForm();

    // Trap two, and the one that cost a second CI round: `exact` looks like the
    // fix for trap one and is not, because the label reads "New password *".
    expect(screen.queryByLabelText("New password", { exact: true })).toBeNull();
    expect(screen.getByLabelText("New password *", { exact: true })).toBeInTheDocument();
  });

  it("is disambiguated by an anchored regex, which is what the spec uses", () => {
    renderForm();

    // The locator that actually works, asserted here so a change to the label
    // breaks this fast test rather than a six-minute CI job.
    expect(screen.getAllByLabelText(/^New password/)).toHaveLength(1);
    expect(screen.getAllByLabelText(/^Confirm new password/)).toHaveLength(1);
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
