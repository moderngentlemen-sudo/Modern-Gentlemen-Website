import { expect, test, type Page } from "@playwright/test";

/**
 * The navigation admin, end to end.
 *
 * What this proves that no unit test can: that `navigation.write` is actually
 * asserted through a real session against real RLS, that a child row carries its
 * `parent_id` through the create dialog, and — the part with a public
 * consequence — that a menu edit reaches the site, because the chrome is
 * rendered by the site layout and only `revalidatePath("/", "layout")` refreshes
 * it.
 *
 * **Locators are exact from the start.** CI run #49 failed when seeded article
 * titles made `getByRole("link", { name: "History" })` match two elements:
 * Playwright matches an accessible name as a substring by default. A menu is a
 * list of short labels — "Style", "Store" — so this spec is the *most* exposed
 * to that failure of any in the suite.
 *
 * Credentials come from the environment; scripts/create-admin.ts provisions the
 * account and CI exports both variables.
 */
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

/** Minted inside the first test, not at module scope: Playwright retries a
 *  serial group from its first test, and the failed attempt's rows are still in
 *  the database. */
let entryLabel = "";
let childLabel = "";

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin/);
}

test.describe("navigation", () => {
  test.skip(!email || !password, "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set");
  test.describe.configure({ mode: "serial" });

  test("opens the header menu from the list", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/navigation");

    await expect(page.getByRole("cell", { name: "header-primary", exact: true })).toBeVisible();

    // The row's own Edit link, not the first Edit on the page.
    await page
      .getByRole("row", { name: /header-primary/ })
      .getByRole("link", { name: "Edit", exact: true })
      .click();

    await expect(page).toHaveURL(/\/admin\/navigation\/header-primary/);
  });

  test("adds a top-level entry", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/navigation/header-primary");

    entryLabel = `E2E Section ${Date.now().toString(36)}`;

    await page.getByRole("button", { name: "Add entry", exact: true }).click();
    await page.getByLabel("Label").fill(entryLabel);
    await page.getByLabel("Links to").selectOption("url");
    await page.getByLabel("URL or path").fill("/e2e-section");
    await page.getByRole("button", { name: "Add", exact: true }).click();

    await expect(page.getByText(entryLabel, { exact: true })).toBeVisible();
  });

  test("refuses a link with no destination", async ({ page }) => {
    // The shape rule `menu_item_target_shape` states in SQL, surfaced as a
    // sentence rather than a constraint violation.
    await signIn(page);
    await page.goto("/admin/navigation/header-primary");

    await page.getByRole("button", { name: "Add entry", exact: true }).click();
    await page.getByLabel("Label").fill("Nowhere");
    await page.getByLabel("Links to").selectOption("category");
    await page.getByRole("button", { name: "Add", exact: true }).click();

    await expect(page.getByText(/Choose which category this points at/)).toBeVisible();
  });

  test("nests a sub-link under the new entry and gives it a column", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/navigation/header-primary");

    childLabel = `E2E Link ${Date.now().toString(36)}`;

    // The "Add sub-link" button inside the new entry's own block.
    await page
      .locator("li")
      .filter({ hasText: entryLabel })
      .getByRole("button", { name: "Add sub-link", exact: true })
      .first()
      .click();

    await page.getByLabel("Label").fill(childLabel);
    await page.getByLabel("Links to").selectOption("url");
    await page.getByLabel("URL or path").fill("/e2e-link");
    await page.getByLabel("Column").fill("E2E Column");
    await page.getByRole("button", { name: "Add", exact: true }).click();

    await expect(page.getByText(childLabel, { exact: true })).toBeVisible();
    await expect(page.getByText("E2E Column", { exact: true })).toBeVisible();
  });

  test("renames the entry", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/navigation/header-primary");

    const renamed = `${entryLabel} renamed`;

    await page
      .locator("div")
      .filter({ hasText: entryLabel })
      .getByRole("button", { name: "Edit", exact: true })
      .first()
      .click();

    await page.getByLabel("Label").fill(renamed);
    await page.getByRole("button", { name: "Save", exact: true }).click();

    await expect(page.getByText(renamed, { exact: true })).toBeVisible();
    entryLabel = renamed;
  });

  test("deletes the entry and its child with it", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/navigation/header-primary");

    await page
      .locator("div")
      .filter({ hasText: entryLabel })
      .getByRole("button", { name: "Delete", exact: true })
      .first()
      .click();

    // The confirmation names what goes with it — `parent_id` cascades.
    await expect(page.getByText(/sub-link/)).toBeVisible();
    await page.getByRole("button", { name: "Delete", exact: true }).last().click();

    await expect(page.getByText(entryLabel, { exact: true })).toHaveCount(0);
    await expect(page.getByText(childLabel, { exact: true })).toHaveCount(0);
  });

  test("the public header still renders the seeded menu", async ({ page }) => {
    // The point of the whole phase: the chrome reads these rows. If the seed's
    // six entries are not in the header, the public read path is broken
    // regardless of what the admin screen shows.
    await page.goto("/");

    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav.getByRole("link", { name: "Style", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Store", exact: true })).toBeVisible();
  });
});
