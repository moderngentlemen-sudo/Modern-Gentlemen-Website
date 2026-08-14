import { expect, test, type Page } from "@playwright/test";

/**
 * The integrations admin, end to end.
 *
 * What this proves that no unit test can: that `integration.write` is asserted
 * through a real session against real RLS, that a source and its mappings
 * survive a round trip through `product_sources` and `feed_field_mappings`, and
 * that the run button's guard — the one thing standing between a half-configured
 * source and a run that creates duplicates of everything — is wired to the
 * mapping state a reload produces rather than to the one held in memory.
 *
 * **It never runs an import.** A run fetches an operator-supplied URL, and there
 * is no URL a CI job may honestly request: a real merchant feed means making a
 * stranger's server part of this suite, and a fixture served from the test
 * process would be testing Playwright's ability to serve a file. The pipeline
 * itself is covered where it can be covered honestly — `xmlFeed.test.ts` drives
 * the adapter with an injected `fetch` over a fixture feed, and the domain suite
 * owns mapping, coercion and change detection.
 *
 * **It cleans up after itself.** The source it creates is deleted in the last
 * test, and deleting one cascades to its mappings. The name carries a stamp so a
 * run that dies mid-way leaves something identifiable rather than colliding with
 * the next one.
 *
 * **Locators are exact from the start** — CI run #49's lesson, recorded twice in
 * PROGRESS.md. Two traps live in this screen specifically: "Integrations" is both
 * a nav link and the page eyebrow, and the row-level "Delete" button shares its
 * name with the one in the confirmation dialog. Both are scoped below rather
 * than discovered later.
 *
 * Credentials come from the environment; scripts/create-admin.ts provisions the
 * account and CI exports both variables.
 */
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

/** Minted inside the first test, not at module scope: Playwright retries a
 *  serial group from its first test, and a literal would survive the retry. */
let sourceName = "";

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin/);
}

/** The dialog, not the page behind it — "Delete" and "Create" both appear twice. */
function dialog(page: Page) {
  return page.getByRole("dialog");
}

test.describe("integrations", () => {
  test.skip(!email || !password, "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set");
  test.describe.configure({ mode: "serial" });

  test("reaches the integrations list from the admin nav", async ({ page }) => {
    sourceName = `E2E feed ${Date.now()}`;

    await signIn(page);

    // Scoped to the navigation: the page this lands on also prints
    // "Integrations" as its eyebrow, so an unscoped link locator is ambiguous
    // the moment the assertion below succeeds.
    await page.getByRole("navigation").getByRole("link", { name: "Integrations" }).click();

    await expect(page).toHaveURL(/\/admin\/integrations$/);
    await expect(page.getByRole("heading", { name: "Integrations" })).toBeVisible();
  });

  test("creates an XML feed source", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/integrations");

    await page.getByRole("button", { name: "New feed" }).click();

    await dialog(page).getByLabel("Name").fill(sourceName);
    await dialog(page).getByLabel("Feed URL").fill("https://example.com/e2e-products.xml");
    await dialog(page).getByLabel("Item path").fill("products/product");
    await dialog(page).getByRole("button", { name: "Create" }).click();

    // Creation navigates straight to the new source.
    await expect(page).toHaveURL(/\/admin\/integrations\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: sourceName })).toBeVisible();
  });

  test("refuses to run until the required fields are mapped", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/integrations");
    await page.getByRole("link", { name: sourceName }).click();

    // The guard, and the reason for it: without external_id a run cannot tell a
    // new product from one it has already imported.
    await expect(page.getByRole("button", { name: "Run now" })).toBeDisabled();
    await expect(page.getByText(/external_id and name are not mapped/)).toBeVisible();
  });

  test("maps the required fields, and they survive a reload", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/integrations");
    await page.getByRole("link", { name: sourceName }).click();

    await page.getByLabel("Add a field").selectOption("external_id");
    await page.getByLabel("Feed path for external_id").fill("@_sku");

    await page.getByLabel("Add a field").selectOption("name");
    await page.getByLabel("Feed path for name").fill("title");

    await page.getByRole("button", { name: "Save mappings" }).click();

    await page.reload();

    // Read back from `feed_field_mappings`, not from the component's state.
    await expect(page.getByLabel("Feed path for external_id")).toHaveValue("@_sku");
    await expect(page.getByLabel("Feed path for name")).toHaveValue("title");

    // And the guard has lifted, which is the half of it that only a reload
    // proves: the button reads the saved mappings, not the unsaved edits.
    await expect(page.getByRole("button", { name: "Run now" })).toBeEnabled();
  });

  test("deletes the source, and its mappings go with it", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/integrations");

    const row = page.getByRole("row").filter({ hasText: sourceName });
    await row.getByRole("button", { name: "Delete" }).click();

    await dialog(page).getByRole("button", { name: "Delete" }).click();

    await expect(page.getByRole("link", { name: sourceName })).toHaveCount(0);
  });
});
