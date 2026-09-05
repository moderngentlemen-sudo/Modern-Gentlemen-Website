import { expect, test, type Page } from "@playwright/test";

/**
 * The media library, end to end: upload an asset, describe it, put it on a
 * page, watch the usage record appear, be refused the delete, then remove it
 * from the page and delete it for real.
 *
 * The refusal is the point of the whole phase. `media_usages` exists so that
 * deleting an in-use asset is a decision an editor makes with the facts in
 * front of them, and until this runs, nothing has ever proved the reconciliation
 * → refusal path works against a real database.
 *
 * Credentials come from the environment, as in the other signed-in specs;
 * scripts/create-admin.ts provisions the account and CI exports both variables.
 */
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

/**
 * Minted by the first test rather than at module scope — Playwright retries a
 * serial group from its first test, and the failed attempt's rows are still in
 * the database, so fixed names would collide on the second run.
 */
let assetName = "";
let pageTitle = "";
let pageSlug = "";
let assetUrl = "";

/**
 * A 1×1 PNG, as bytes. Small enough to be inline, real enough that the MIME
 * check, the checksum and the storage upload all do their actual work.
 */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin/);
}

test.describe("media library", () => {
  test.skip(!email || !password, "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set");
  test.describe.configure({ mode: "serial" });

  test("uploads an asset and describes it", async ({ page }) => {
    await signIn(page);

    const stamp = Date.now().toString(36);
    assetName = `e2e-media-${stamp}.png`;
    pageTitle = `E2E Media ${stamp}`;
    pageSlug = `e2e-media-${stamp}`;

    await page.goto("/admin/media");

    // The input is visually hidden behind a "Choose files" button; setting the
    // files directly is the supported way to drive it.
    await page.locator('input[type="file"]').setInputFiles({
      name: assetName,
      mimeType: "image/png",
      // Bytes after IEND preserve the rendered pixel while crossing Next's
      // old 1 MiB action limit. Exercise the real multipart upload boundary.
      buffer: Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]),
    });

    // The details panel opens on the freshly uploaded asset.
    //
    // Given its own timeout rather than the 5s default: one upload is a file
    // read, a SHA-256, a storage PUT, a catalogue insert and a revalidation,
    // and on a cold server in CI that comfortably outruns five seconds. The
    // first CI run marked this flaky for exactly that reason — the assertion
    // was racing the round trip, not finding a real absence.
    await expect(page.getByText(assetName).first()).toBeVisible({ timeout: 30_000 });

    // Alt text is the one piece of metadata a published page cannot do without,
    // and the grid flags its absence — so setting it also clears that flag.
    await page.getByLabel("Alt text").fill("A test asset");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Saved")).toBeVisible();

    // The URL the picker will write into a block. Read from the panel so the
    // test asserts on what the app actually produced, not on a shape it guessed.
    assetUrl = (
      await page
        .getByText(/\/storage\/v1\/object\/public\/media\//)
        .first()
        .innerText()
    ).trim();
    expect(assetUrl).toContain(assetName.replace(".png", ""));

    await expect(page.getByText("Nothing references this asset")).toBeVisible();
  });

  test("records a usage when the asset is placed on a page", async ({ page }) => {
    await signIn(page);

    await page.goto("/admin/pages");
    await page.getByRole("button", { name: "New page" }).click();

    const dialog = page.getByRole("dialog", { name: "New page" });
    await dialog.getByLabel("Title").fill(pageTitle);
    await dialog.getByLabel("Slug").fill(pageSlug);
    await dialog.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/pages\/[0-9a-f-]{36}$/);

    // A hero carries `media.image`, which is the field the reference walk reads.
    await page
      .getByRole("button", { name: /^Hero — Cover Star/i })
      .first()
      .click();
    await expect(page.locator("[data-block-key]")).toHaveCount(1);
    await page.locator("[data-block-key]").first().click();

    // Typed rather than picked: the point under test is that a stored URL
    // resolves back to an asset, and typing exercises exactly the path an
    // editor pasting a URL would take.
    await page.getByRole("textbox", { name: "Image", exact: true }).fill(assetUrl);

    await page.keyboard.press("Control+s");
    await expect(page.getByText(/Saved/)).toBeVisible();

    // Reconciliation runs inside the save, so by the time the library is
    // re-rendered the usage row is there.
    await page.goto("/admin/media");
    await page.getByRole("button", { name: new RegExp(assetName.replace(".png", "")) }).click();
    await expect(page.getByRole("link", { name: pageTitle })).toBeVisible();
  });

  test("refuses to delete an asset that is in use", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/media");
    await page.getByRole("button", { name: new RegExp(assetName.replace(".png", "")) }).click();

    await page.getByRole("button", { name: "Danger" }).click();
    await expect(page.getByText("This asset is in use")).toBeVisible();
    // Disabled rather than merely warned about: the refusal is enforced in the
    // service too, but an editor should not be able to fire a doomed request.
    await expect(page.getByRole("button", { name: "Delete asset" })).toBeDisabled();
  });

  /**
   * A gallery is the other kind of reference, and the one `media_usages` does
   * not record. `product_media` is written straight by the products admin and
   * is never walked by the reconciliation that fills `media_usages`, so before
   * `deleteAsset` learned to ask both tables an asset could be the hero
   * photograph on six product pages and read as completely unreferenced —
   * deletable in one click, with `on delete cascade` quietly taking the
   * photographs off the live storefront.
   *
   * Self-contained on purpose: it creates its own product and deletes it again,
   * so the asset is left exactly as the next test expects to find it.
   */
  test("counts a product gallery as a reference", async ({ page }) => {
    await signIn(page);

    const productName = `E2E Gallery ${Date.now().toString(36)}`;
    await page.goto("/admin/products");
    await page.getByRole("button", { name: "New product" }).click();
    const dialog = page.getByRole("dialog", { name: "New product" });
    await dialog.getByLabel("Name").fill(productName);
    await dialog.getByLabel("Slug").fill(productName.toLowerCase().replace(/\s+/g, "-"));
    await dialog.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/products\/[0-9a-f-]{36}$/);
    const productUrl = page.url();

    await page.getByRole("button", { name: "Attach an image" }).click();
    await page
      .getByRole("dialog", { name: "Choose an image" })
      .getByRole("button", { name: new RegExp(assetName.replace(".png", "")) })
      .click();
    await expect(page.getByText("primary")).toBeVisible();

    // The asset now has two references from two different tables. The page one
    // was already there; this asserts the gallery one joined it rather than
    // replacing it, because the union is the part that was missing.
    await page.goto("/admin/media");
    await page.getByRole("button", { name: new RegExp(assetName.replace(".png", "")) }).click();
    await expect(page.getByRole("link", { name: productName })).toBeVisible();
    await expect(page.getByRole("link", { name: pageTitle })).toBeVisible();

    // Deleting the product takes the gallery row with it — `product_media`
    // cascades on product_id as well as asset_id.
    await page.goto(productUrl);
    await page.goto("/admin/products");
    await page
      .getByRole("row", { name: new RegExp(productName) })
      .getByRole("button", { name: "Delete" })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Delete product", exact: true })
      .click();
    await expect(page.getByRole("link", { name: productName })).toHaveCount(0);

    await page.goto("/admin/media");
    await page.getByRole("button", { name: new RegExp(assetName.replace(".png", "")) }).click();
    await expect(page.getByRole("link", { name: productName })).toHaveCount(0);
  });

  test("deletes the asset once nothing references it, and cleans up", async ({ page }) => {
    await signIn(page);

    // Remove the reference by deleting the page that holds it.
    await page.goto("/admin/pages");
    await page
      .getByRole("row", { name: new RegExp(pageTitle) })
      .getByRole("button", { name: "Delete" })
      .click();
    // "Delete page", not "Delete": each confirmation dialog in the admin names
    // the thing it destroys, and `exact` means the shorter string never matches.
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Delete page", exact: true })
      .click();
    await expect(page.getByRole("link", { name: pageTitle })).toHaveCount(0);

    // Nothing in the database cleans this up: `media_usages.entity_id` is
    // polymorphic and carries no foreign key, so `documents.deleteDocument`
    // clears the rows itself. Without that call the asset would stay
    // permanently undeletable, blocked by a page that no longer exists — which
    // is exactly what this assertion is here to catch if it ever regresses.
    await page.goto("/admin/media");
    await page.getByRole("button", { name: new RegExp(assetName.replace(".png", "")) }).click();
    await expect(page.getByText("Nothing references this asset")).toBeVisible();

    await page.getByRole("button", { name: "Danger" }).click();
    await page.getByRole("button", { name: "Delete asset" }).click();
    await expect(page.getByText(`Deleted "${assetName}"`)).toBeVisible();

    // Asserted by role, not by text: the success toast says the file name and
    // lingers for DISMISS_MS, so a text locator would match the confirmation of
    // the removal rather than the thing removed. Phase 4 learned this once.
    await expect(
      page.getByRole("button", { name: new RegExp(assetName.replace(".png", "")) })
    ).toHaveCount(0);
  });
});
