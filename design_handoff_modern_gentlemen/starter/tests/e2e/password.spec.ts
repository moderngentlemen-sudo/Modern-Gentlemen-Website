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

    // Scoped to the navigation rail: "Password" is also a field label on the
    // page it opens, so an unscoped locator becomes ambiguous the moment the
    // assertion below succeeds. Same trap as "Integrations" on the feeds screen.
    await page.getByRole("navigation").getByRole("link", { name: "Password" }).click();

    await expect(page).toHaveURL(/\/admin\/password$/);
    await expect(page.getByRole("heading", { name: "Password" })).toBeVisible();
  });

  test("refuses a short password and a mismatched pair, without saving either", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/admin/password");

    const update = page.getByRole("button", { name: "Update password" });

    await page.getByLabel("New password").fill("short");
    await page.getByLabel("Confirm new password").fill("short");
    await expect(page.getByText(/at least 12 characters/i)).toBeVisible();
    await expect(update).toBeDisabled();

    await page.getByLabel("New password").fill("correct horse battery staple");
    await page.getByLabel("Confirm new password").fill("correct horse battery stapl");
    await expect(page.getByText(/do not match/i)).toBeVisible();
    await expect(update).toBeDisabled();
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
