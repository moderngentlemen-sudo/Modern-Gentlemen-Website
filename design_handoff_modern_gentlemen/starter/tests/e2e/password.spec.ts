import { expect, test, type Page } from "@playwright/test";

/**
 * The password-recovery surface, end to end as far as it can honestly go.
 *
 * ⚠️ **No test here ever completes a password change, and that is deliberate
 * rather than an omission.** Every signed-in spec in this suite authenticates
 * with `E2E_ADMIN_PASSWORD`; a test that successfully changed the CI admin's
 * password would pass, and then break every spec that ran after it — including
 * itself on retry. So the admin half asserts only the *refusals*, which is where
 * the logic worth testing lives anyway.
 *
 * The email round trip is likewise not simulated. Proving a link arrives means
 * reading Supabase's local mail server, which tests GoTrue rather than this
 * application; `lib/domain/passwords.test.ts` owns the rules and this file owns
 * the wiring.
 */
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin/);
}

test.describe("password recovery — public", () => {
  test("reaches the reset form from sign-in", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByRole("link", { name: "Forgot your password?" }).click();

    await expect(page).toHaveURL(/\/forgot-password$/);
    await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
  });

  test("refuses an address that is not an email", async ({ page }) => {
    await page.goto("/forgot-password");

    await page.getByLabel("Email").fill("not-an-email");
    await page.getByRole("button", { name: "Send reset link" }).click();

    await expect(page.getByText("That does not look like an email")).toBeVisible();
  });

  test("answers the same way for an address with no account", async ({ page }) => {
    await page.goto("/forgot-password");

    // Deliberately an address that cannot exist. The assertion is that the
    // response is the neutral one — anything that distinguished "no such
    // account" would be an enumeration oracle, and this endpoint needs no
    // password to probe with.
    await page.getByLabel("Email").fill(`nobody-${Date.now()}@example.invalid`);
    await page.getByRole("button", { name: "Send reset link" }).click();

    await expect(page.getByText(/a reset link is on its way/i)).toBeVisible();
    await expect(page.getByText(/no account|not found|unknown/i)).toHaveCount(0);
  });
});

test.describe("password recovery — signed in", () => {
  test.skip(!email || !password, "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set");

  test("the admin can reach its own password page", async ({ page }) => {
    await signIn(page);

    // NOT scoped to `getByRole("navigation")` — this link deliberately lives in
    // the rail's account footer, beside Light/Dark and Sign out, which is
    // outside the `<nav>`. Scoping it there found nothing. `exact` because the
    // page it opens has a "Password" heading and two labels containing the word.
    await page.getByRole("link", { name: "Password", exact: true }).click();

    await expect(page).toHaveURL(/\/admin\/password$/);
    await expect(page.getByRole("heading", { name: "Password" })).toBeVisible();
  });

  test("refuses a short password and a mismatched pair, without saving either", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/admin/password");

    const update = page.getByRole("button", { name: "Update password" });

    // ⚠️ Anchored regexes, and neither a plain string nor `exact` works here.
    // Both were tried and both failed in CI, for opposite reasons:
    //
    //   getByLabel("New password")                 → 2 elements. Substring by
    //     default, and "Confirm **new password**" contains it.
    //   getByLabel("New password", {exact: true})  → 0 elements. `FieldShell`
    //     appends a required asterisk in an `aria-hidden` span, so the label's
    //     text is "New password *". Playwright matches that rendered text —
    //     `aria-hidden` does *not* exclude it, even though the accessible name
    //     does. So the exact string never matches.
    //
    // `^` disambiguates the two fields without depending on the asterisk.
    const next = page.getByLabel(/^New password/);
    const confirm = page.getByLabel(/^Confirm new password/);

    await next.fill("short");
    await confirm.fill("short");
    // ⚠️ Matched on the full sentence, not /at least 12 characters/. The field's
    // own help text reads "At least 12 characters, and under 72 bytes…", so the
    // loose pattern matches the help *and* the error. These strings come from
    // `lib/domain/passwords.ts`.
    await expect(page.getByText("Use at least 12 characters.")).toBeVisible();
    await expect(update).toBeDisabled();

    await next.fill("correct horse battery staple");
    await confirm.fill("correct horse battery stapl");
    await expect(page.getByText("Those two passwords do not match.")).toBeVisible();
    await expect(update).toBeDisabled();
  });

  /**
   * The current-password gate, end to end — and it is written so that a
   * **broken** gate fails loudly instead of locking the suite out of its own
   * account.
   *
   * The new password submitted here is the account's *existing* one. If the gate
   * works, the wrong current password is refused and nothing is written. If the
   * gate were removed, the update would reach GoTrue and be refused there with a
   * different sentence ("New password should be different from the old
   * password") — so the assertion below fails, and the password is still
   * unchanged either way. A test that proves a lock works must not be able to
   * change the lock.
   */
  test("refuses a wrong current password", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/password");

    // Present because this session came from a sign-in, not from a reset link.
    // A recovery landing renders no such field — see app/auth/_lib/recovery.ts.
    await page.getByLabel(/^Current password/).fill("definitely not the password");
    await page.getByLabel(/^New password/).fill(password!);
    await page.getByLabel(/^Confirm new password/).fill(password!);

    await page.getByRole("button", { name: "Update password" }).click();

    await expect(page.getByText("That is not your current password.")).toBeVisible();
  });

  test("signing out still works afterwards, so no password was changed", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/password");

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/(sign-in)?$/);

    // The real assertion: the original credentials still work. If any test above
    // had actually changed the password, this is where the suite would say so
    // rather than failing mysteriously in a later file.
    await signIn(page);
  });
});
