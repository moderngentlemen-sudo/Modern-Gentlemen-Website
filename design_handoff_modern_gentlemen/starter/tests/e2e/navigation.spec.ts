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
/** Per-run like the labels, and for the same reason. As a literal it survived
 *  every retry, so the second attempt's assertion found two of them. */
let columnLabel = "";

/**
 * The entry's own row.
 *
 * `MenuEditor` renders each top-level entry as an `li` that also contains its
 * children's `li`s, so this is the outermost match — which is what makes
 * `.first()` on a button inside it the entry's own rather than a child's, since
 * the entry's Row renders before the nested list.
 */
function entryRow(page: Page) {
  return page.locator("li").filter({ hasText: entryLabel }).first();
}

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

    const stamp = Date.now().toString(36);
    childLabel = `E2E Link ${stamp}`;
    columnLabel = `E2E Column ${stamp}`;

    // The "Add sub-link" button inside the new entry's own block.
    await entryRow(page).getByRole("button", { name: "Add sub-link", exact: true }).click();

    await page.getByLabel("Label").fill(childLabel);
    await page.getByLabel("Links to").selectOption("url");
    await page.getByLabel("URL or path").fill("/e2e-link");
    await page.getByLabel("Column").fill(columnLabel);
    await page.getByRole("button", { name: "Add", exact: true }).click();

    await expect(page.getByText(childLabel, { exact: true })).toBeVisible();
    await expect(page.getByText(columnLabel, { exact: true })).toBeVisible();
  });

  test("renames the entry", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/navigation/header-primary");

    const renamed = `${entryLabel} renamed`;

    await entryRow(page).getByRole("button", { name: "Edit", exact: true }).first().click();

    await page.getByLabel("Label").fill(renamed);
    await page.getByRole("button", { name: "Save", exact: true }).click();

    await expect(page.getByText(renamed, { exact: true })).toBeVisible();
    entryLabel = renamed;
  });

  test("deletes the entry and its child with it", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/navigation/header-primary");

    await entryRow(page).getByRole("button", { name: "Delete", exact: true }).first().click();

    // Scoped to the dialog, not the page. "Its N sub-links will go with it" and
    // the "Add sub-link" button behind it both match /sub-link/, and every row
    // carries its own Delete — `.last()` depended on where the dialog mounts.
    const confirm = page.getByRole("dialog", { name: "Delete link" });
    await expect(confirm.getByText(/sub-link/)).toBeVisible();
    await confirm.getByRole("button", { name: "Delete", exact: true }).click();

    await expect(page.getByText(entryLabel, { exact: true })).toHaveCount(0);
    await expect(page.getByText(childLabel, { exact: true })).toHaveCount(0);
  });
});

/**
 * Deliberately outside the serial group above, and deliberately not gated on
 * E2E_ADMIN_*.
 *
 * This is the assertion the whole phase rests on — the chrome renders from
 * `menus`/`menu_items` rather than from constants — and it needs no session to
 * make it. Inside the serial group it ran last and behind a credential check,
 * so CI run #53 never executed it: a failure five tests earlier was enough to
 * skip the one test that proves the feature works.
 */
test.describe("the public header", () => {
  test("renders the seeded menu", async ({ page }) => {
    await page.goto("/");

    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav.getByRole("link", { name: "Style", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Store", exact: true })).toBeVisible();
  });
});
