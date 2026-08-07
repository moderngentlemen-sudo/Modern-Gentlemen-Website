import { expect, test, type Page } from "@playwright/test";

/**
 * The builder, end to end: create a page, compose it, save, publish, roll back.
 *
 * This is the journey Phase 4 exists to make possible, and the first thing that
 * exercises lib/services/* through a real request — publish validation, the
 * autosave throttle and the revision counter included.
 *
 * Credentials come from the environment, as in auth.spec.ts. scripts/create-admin.ts
 * provisions the account.
 */
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

/**
 * Identity for the page this suite creates, minted by the first test.
 *
 * Not a module constant: Playwright retries a serial group from its first test,
 * and the failed attempt's page is still in the database, so a fixed slug would
 * collide on `pages_slug_key` the moment anything downstream failed. Each
 * attempt mints its own, and the later tests read what this attempt wrote.
 */
let pageTitle = "";
let pageSlug = "";

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin/);
}

test.describe("page builder", () => {
  test.skip(!email || !password, "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set");
  test.describe.configure({ mode: "serial" });

  test("creates a page, adds a section, saves, publishes and rolls back", async ({ page }) => {
    await signIn(page);

    // --- create -----------------------------------------------------------
    await page.goto("/admin/pages");
    const stamp = Date.now().toString(36);
    pageTitle = `E2E Builder ${stamp}`;
    pageSlug = `e2e-builder-${stamp}`;

    await page.getByRole("button", { name: "New page" }).click();

    // Scoped to the dialog, and exact. Playwright matches accessible names by
    // substring, so a bare "Create" also matches the empty state's "Create the
    // first page" — which is on screen whenever this runs against a project
    // with no pages yet.
    const newPage = page.getByRole("dialog", { name: "New page" });
    await newPage.getByLabel("Title").fill(pageTitle);
    await newPage.getByLabel("Slug").fill(pageSlug);
    await newPage.getByRole("button", { name: "Create", exact: true }).click();

    // Lands in the builder for the new page.
    await expect(page).toHaveURL(/\/admin\/pages\/[0-9a-f-]{36}$/);
    await expect(page.getByText("Add your first section")).toBeVisible();

    // --- compose ----------------------------------------------------------
    await page
      .getByRole("button", { name: /^Pull quote/i })
      .first()
      .click();
    await expect(page.locator("[data-block-key]")).toHaveCount(1);

    // By role, not by label. getByLabel matches substrings, and every block
    // toolbar button is named after its block — "Drag Pull quote", "Hide Pull
    // quote" and so on — so getByLabel("Quote") matched six elements.
    const quote = page.getByRole("textbox", { name: "Quote" });
    await expect(quote).toBeVisible();
    await quote.fill("Speed, considered.");

    // --- save -------------------------------------------------------------
    // Autosave debounces; Cmd/Ctrl+S flushes immediately.
    await page.keyboard.press("ControlOrMeta+s");
    await expect(page.getByText(/^Saved /)).toBeVisible({ timeout: 15_000 });

    // --- publish ----------------------------------------------------------
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: /Publish/ });
    await expect(dialog.getByText("No issues")).toBeVisible();
    await dialog.getByRole("button", { name: "Publish", exact: true }).click();

    await expect(page.getByText(/Published v\d+/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("published", { exact: true })).toBeVisible();

    // --- history + rollback ----------------------------------------------
    await page.getByRole("link", { name: "History", exact: true }).click();
    await expect(page).toHaveURL(/\/history$/);

    const publishRow = page.getByRole("row").filter({ hasText: "publish" }).first();
    await expect(publishRow).toBeVisible();

    await publishRow.getByRole("button", { name: "Restore" }).click();
    await page.getByRole("button", { name: "Restore into draft" }).click();

    // The wording is the assertion: rollback restores into the DRAFT and
    // publishes nothing.
    await expect(page.getByText(/Restored v\d+ into the draft/)).toBeVisible({ timeout: 15_000 });
  });

  test("refuses to publish a page whose blocks fail validation", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/pages");
    await page.getByRole("link", { name: pageTitle }).click();

    // Nothing is selected on a fresh load, so the panel shows its empty state
    // and the field does not exist yet. Select the block first — the canvas
    // selects on mousedown.
    await page.locator("[data-block-key]").first().click();

    // Emptying a required field is an issue the manifests catch.
    await page.getByRole("textbox", { name: "Quote" }).fill("");

    await expect(page.getByText(/fix before publishing/i)).toBeVisible();

    await page.getByRole("button", { name: "Publish", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: /Publish/ });
    await expect(dialog.getByRole("button", { name: "Publish", exact: true })).toBeDisabled();
  });

  test("cleans up the page it created", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/pages");

    const row = page.getByRole("row").filter({ hasText: pageTitle });
    await row.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete page" }).click();

    // By role, not by text. The success toast reads `Deleted "E2E Builder Page"`
    // and lingers for five seconds, so a plain text query races the toast's own
    // dismissal and sees a count of 1 long after the row has gone. The link in
    // the table is the thing whose absence actually means "deleted".
    await expect(page.getByRole("link", { name: pageTitle })).toHaveCount(0);
  });
});
