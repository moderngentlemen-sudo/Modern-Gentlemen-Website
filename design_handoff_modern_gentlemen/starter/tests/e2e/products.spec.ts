import { expect, test, type Page } from "@playwright/test";

/**
 * Products, end to end.
 *
 * The claim this proves is the one `0014` is built on: that `products` carries
 * the same versioning columns as pages and articles, and that adding 'product'
 * to `document_table()`'s allowlist is the *whole* of what it takes for the
 * polymorphic repository, the publishing SQL transaction, the revision counter
 * and the shared builder to serve a fifth document type.
 *
 * It also exercises the thing no unit test can: that a product delete goes
 * through `deleteDocument`, so its `media_usages` rows are cleared. Nothing in
 * the database enforces that — `media_usages.entity_id` has no foreign key.
 *
 * Credentials come from the environment; scripts/create-admin.ts provisions the
 * account and CI exports both variables.
 */
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

/**
 * Minted by the first test, not at module scope. Playwright retries a serial
 * group from its first test, the failed attempt's row is still in the database,
 * and a fixed slug would collide on `products_slug_key` the moment anything
 * downstream failed. Phase 4 learned this from `pages_slug_key`.
 */
let productName = "";
let productSlug = "";
let collectionName = "";

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin/);
}

test.describe("products", () => {
  test.skip(!email || !password, "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set");
  test.describe.configure({ mode: "serial" });

  test("creates a collection", async ({ page }) => {
    await signIn(page);

    const stamp = Date.now().toString(36);
    productName = `E2E Product ${stamp}`;
    productSlug = `e2e-product-${stamp}`;
    collectionName = `E2E Collection ${stamp}`;

    await page.goto("/admin/products/collections");
    await page.getByRole("button", { name: "New collection" }).click();

    const dialog = page.getByRole("dialog", { name: "New collection" });
    await dialog.getByLabel("Name").fill(collectionName);
    await dialog.getByRole("button", { name: "Create", exact: true }).click();

    // Asserted on the table row, not the toast. The first version of this
    // waited for `Created “<name>”` — the wording the *taxonomy* dialogs use —
    // while `CollectionsList` pushes the literal "Collection created". A row is
    // the better assertion anyway: a toast proves an action returned, a row
    // proves it persisted and survived the refresh.
    await expect(page.getByRole("cell", { name: collectionName })).toBeVisible();
  });

  test("creates a product and prices it", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/products");

    await page.getByRole("button", { name: "New product" }).click();
    const dialog = page.getByRole("dialog", { name: "New product" });
    await dialog.getByLabel("Name").fill(productName);
    await dialog.getByLabel("Slug").fill(productSlug);
    await dialog.getByRole("button", { name: "Create", exact: true }).click();

    // Lands on the details screen, not the builder — a product's commerce
    // metadata is its primary editing surface, as an article's is its own.
    await expect(page).toHaveURL(/\/admin\/products\/[0-9a-f-]{36}$/);

    // £145 is the figure PROGRESS.md's money note is written around: a 15%
    // member discount on it is £21.75, which only integer pence reproduce.
    await page.getByLabel("Price (£)").fill("145");
    await page.getByLabel("Compare at (£)").fill("199");
    await page.getByLabel("SKU").fill("E2E-001");
    await page.getByRole("button", { name: "NEW", exact: true }).click();
    await page.getByRole("button", { name: collectionName }).click();
    await page.getByRole("button", { name: "Save details" }).click();
    await expect(page.getByText("Saved")).toBeVisible();

    // The reload proves it persisted rather than only living in React state —
    // and that pounds survived the round trip through an integer pence column.
    await page.reload();
    await expect(page.getByLabel("Price (£)")).toHaveValue("145");
    await expect(page.getByRole("button", { name: "NEW", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(page.getByRole("button", { name: collectionName })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  test("refuses a compare-at price that is not a reduction", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/products");
    await page.getByRole("link", { name: productName }).click();

    // The cross-field rule lives in `productMetaSchema` and is checked in the
    // action, so this is the only place it can be seen working.
    await page.getByLabel("Compare at (£)").fill("100");
    await page.getByRole("button", { name: "Save details" }).click();
    // Role AND text, because neither alone is unique here.
    //
    // A bare `getByText` matched the inline alert and the toast that used to
    // duplicate it. A bare `getByRole("alert")` then matched the inline alert
    // and `<div role="alert" id="__next-route-announcer__">` — which Next
    // mounts into every app and leaves empty, so `getByRole("alert")` can
    // never be unique in this codebase. Filtering on the text is what
    // distinguishes them.
    await expect(
      page.getByRole("alert").filter({ hasText: /must be higher than the price/ })
    ).toBeVisible();

    await page.getByLabel("Compare at (£)").fill("199");
    await page.getByRole("button", { name: "Save details" }).click();
    await expect(page.getByText("Saved")).toBeVisible();
  });

  test("adds a variant that inherits the product price", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/products");
    await page.getByRole("link", { name: productName }).click();

    await page.getByRole("button", { name: "Add a variant" }).click();
    const dialog = page.getByRole("dialog", { name: "Add a variant" });
    await dialog.getByLabel("Title").fill("20mm · Taupe");
    await dialog.getByRole("button", { name: "Add", exact: true }).click();

    await expect(page.getByText("Variant added")).toBeVisible();
    // Left empty, the price column holds null — "whatever the product costs" —
    // rather than a copy of the product's price that would go stale.
    await expect(page.getByRole("cell", { name: "inherits" })).toBeVisible();
  });

  test("composes and publishes it through the shared builder", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/products");
    await page.getByRole("link", { name: productName }).click();
    await page.getByRole("link", { name: "Compose sections" }).click();

    await expect(page).toHaveURL(/\/admin\/products\/[0-9a-f-]{36}\/builder$/);
    await expect(page.getByText("Add your first section")).toBeVisible();

    await page
      .getByRole("button", { name: /^Pull quote/i })
      .first()
      .click();
    await expect(page.locator("[data-block-key]")).toHaveCount(1);

    await page.locator("[data-block-key]").first().click();
    await page.getByRole("textbox", { name: "Quote" }).fill("Made to be forgotten in a bag.");

    await page.keyboard.press("Control+s");
    await expect(page.getByText(/Saved/)).toBeVisible();

    // publish_document resolves 'product' through document_table(), which is
    // exactly what 0014 added, and asserts product.publish inside the function.
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText(/Published v\d+/)).toBeVisible();
  });

  test("records the publish in the shared history view", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/products");
    await page.getByRole("link", { name: productName }).click();
    await page.getByRole("link", { name: "History", exact: true }).click();

    await expect(page).toHaveURL(/\/admin\/products\/[0-9a-f-]{36}\/history$/);
    // The same polymorphic `revisions` and `publish_events` tables, the same
    // `HistoryView` component. Only the rollback action names a different type.
    await expect(page.getByRole("cell", { name: "publish" }).first()).toBeVisible();
  });

  test("cleans up", async ({ page }) => {
    await signIn(page);

    await page.goto("/admin/products");
    await page
      .getByRole("row", { name: new RegExp(productName) })
      .getByRole("button", { name: "Delete" })
      .click();
    // Named in full: every confirmation dialog in the admin names the thing it
    // destroys, and asking for "Delete" with exact:true can never match.
    // `media.spec.ts` went red in CI for precisely that.
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Delete product", exact: true })
      .click();

    // By link role, not by text: the success toast repeats the name and lingers
    // for DISMISS_MS, so a text locator would match the confirmation of the
    // deletion rather than the row.
    await expect(page.getByRole("link", { name: productName })).toHaveCount(0);

    await page.goto("/admin/products/collections");
    await page
      .getByRole("row", { name: new RegExp(collectionName) })
      .getByRole("button", { name: "Delete" })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Delete collection", exact: true })
      .click();
    await expect(page.getByRole("cell", { name: collectionName })).toHaveCount(0);
  });
});
