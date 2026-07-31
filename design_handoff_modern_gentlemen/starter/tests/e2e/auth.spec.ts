import { expect, test } from "@playwright/test";

/**
 * Auth journeys, end to end across UI, middleware, Supabase Auth and RLS.
 *
 * Credentials come from the environment so no password is ever committed.
 * scripts/create-admin.ts provisions the account; export E2E_ADMIN_EMAIL and
 * E2E_ADMIN_PASSWORD to run the signed-in cases.
 */
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

test.describe("admin access control", () => {
  test("unauthenticated /admin redirects to sign-in and remembers the destination", async ({
    page,
  }) => {
    await page.goto("/admin");

    await expect(page).toHaveURL(/\/sign-in\?next=%2Fadmin/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("a nested admin route also redirects", async ({ page }) => {
    await page.goto("/admin/builder");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("rejects bad credentials without revealing whether the account exists", async ({ page }) => {
    await page.goto("/sign-in");

    await page.getByLabel("Email").fill("nobody@example.com");
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    // Scoped by test id: Next's route announcer also carries role="alert".
    const alert = page.getByTestId("sign-in-error");
    await expect(alert).toBeVisible();
    await expect(alert).toHaveText(/not recognised/i);
    // Still on the form; no session was established.
    await expect(page).toHaveURL(/\/sign-in/);
  });
});

test.describe("signed-in admin", () => {
  test.skip(!email || !password, "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set");

  test("signs in, lands on /admin, and sees the resolved permission set", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/sign-in/);

    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in" }).click();

    // Redirected back to the originally requested page.
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // The full chain resolved: Auth → user_roles → role_permissions → UI.
    await expect(page.getByText(/Permissions — 40 granted/)).toBeVisible();
    await expect(page.getByText(email!)).toBeVisible();
  });

  test("signing out ends the session and re-protects /admin", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin$/);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/^https?:\/\/[^/]+\/$/);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("an already signed-in visitor is bounced off the sign-in form", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto("/sign-in");
    await expect(page).toHaveURL(/\/admin$/);
  });
});
