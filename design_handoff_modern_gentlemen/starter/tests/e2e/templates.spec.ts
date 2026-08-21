import { expect, test, type Page } from "@playwright/test";

/**
 * Templates, end to end — the first document whose payload holds more than one
 * block tree.
 *
 * What needs a real browser here is not the CRUD, which is the patterns screen
 * with a `kind` column. It is the **area switch**: the store banks the open
 * tree into `doc.rest`, swaps in another, and reassembles the whole payload on
 * save. Every way that can go wrong is invisible to a unit test that never
 * round-trips through the database — an area written to a literal `"areas.main"`
 * key, an edit banked into `rest` but never sent, a save that carries the open
 * area and drops the others. The reload assertions below are the point of the
 * file; the clicks are how you get there.
 *
 * Credentials come from the environment; scripts/create-admin.ts provisions the
 * account and CI exports both variables.
 */
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

/** Minted by the first test — a retry re-runs a serial group from the top. */
let templateName = "";
let templateKey = "";

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin/);
}

/**
 * An area chip, located by `data-area` rather than by accessible name.
 *
 * Deliberate, and the reason is the trap this repository keeps re-learning.
 * The chip carries a validation-issue badge *inside the button*, so the
 * accessible name of an area holding one issue is "header 1" — a name match
 * would work until a block went invalid and then stop, in a way that reads as
 * a missing element. Matching loosely instead is no better: Playwright matches
 * names by substring, so "header" would also match "header-two". The columns
 * spec lost a CI run to exactly this with "Drag Column" matching "Drag Columns
 * — layout", and `getByLabel("Quote")` matched six elements before that.
 */
function area(page: Page, name: string) {
  return page.locator(`[role="tab"][data-area="${name}"]`);
}

/** Autosave debounces; Cmd/Ctrl+S flushes it and the bar reports when it lands. */
async function save(page: Page) {
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.getByText(/^Saved /)).toBeVisible({ timeout: 15_000 });
}

test.describe("templates", () => {
  test.skip(!email || !password, "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set");
  test.describe.configure({ mode: "serial" });

  test("creates one, and it opens on a single area", async ({ page }) => {
    await signIn(page);

    const stamp = Date.now().toString(36);
    templateName = `E2E Template ${stamp}`;
    templateKey = `e2e-template-${stamp}`;

    await page.goto("/admin/templates");
    await page.getByRole("button", { name: "New template" }).click();

    const dialog = page.getByRole("dialog", { name: "New template" });
    await dialog.getByLabel("Name").fill(templateName);
    // The key auto-fills from the name; overwritten so the fixture is
    // predictable rather than dependent on how `slugify` treats the stamp.
    await dialog.getByLabel("Key").fill(templateKey);
    await dialog.getByLabel("Kind").selectOption("page");
    await dialog.getByRole("button", { name: "Create", exact: true }).click();

    // Creating opens the builder for the new template.
    await expect(page).toHaveURL(/\/admin\/templates\/[0-9a-f-]{36}$/);

    // ⚠️ The assertion that matters most on this screen. `0003` defaults the
    // column to `{"areas":{}}`, and passing that through produced a template
    // the builder opened with no tree to show and no obvious way forward. The
    // service seeds exactly one area instead.
    await expect(area(page, "main")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("Add your first section")).toBeVisible();
  });

  test("keeps each area's blocks in that area, across a switch and a reload", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/templates");
    await page.getByRole("link", { name: templateName, exact: true }).click();

    // --- compose `main` ---------------------------------------------------
    await page
      .getByRole("button", { name: /^Pull quote/i })
      .first()
      .click();
    await expect(page.locator("[data-block-key]")).toHaveCount(1);

    // By role, not by label: every block toolbar button is named after its
    // block, so getByLabel("Quote") matches the handles too.
    await page.getByRole("textbox", { name: "Quote" }).fill("Composed in main.");
    await save(page);

    // --- a second area ----------------------------------------------------
    await page.getByRole("button", { name: "Add area" }).click();
    const adding = page.getByRole("dialog", { name: "Add an area" });
    await adding.getByLabel("Name").fill("header");
    await adding.getByRole("button", { name: "Add", exact: true }).click();

    // The new area opens, and it is empty — the block belongs to `main`.
    await expect(area(page, "header")).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("[data-block-key]")).toHaveCount(0);

    // ⚠️ A library entry is named by its manifest's `label`, which is **not** its
    // type name. This read `/^Masthead/i` on the first CI run and timed out:
    // the `masthead` block's label is "The Masthead — team", so the anchor never
    // matched. Labels live in `lib/blocks/manifests/*.ts` — read one before
    // writing a locator for it. "Newsletter" is the label verbatim, and the `^`
    // anchor keeps it off the block's own toolbar buttons ("Drag Newsletter",
    // "Hide Newsletter"), which are named after the block they belong to.
    await page
      .getByRole("button", { name: /^Newsletter/i })
      .first()
      .click();
    await expect(page.locator("[data-block-key]")).toHaveCount(1);
    await save(page);

    // --- the round trip ---------------------------------------------------
    // The whole slice in one assertion: after a reload, both areas exist and
    // each still holds its own blocks. A payload written to a literal
    // "areas.main" key, or a save that carried only the open area, fails here
    // and nowhere earlier.
    await page.reload();

    await expect(area(page, "main")).toBeVisible();
    await expect(area(page, "header")).toBeVisible();

    await area(page, "main").click();
    await expect(page.locator("[data-block-key]")).toHaveCount(1);
    await page.locator("[data-block-key]").first().click();
    await expect(page.getByRole("textbox", { name: "Quote" })).toHaveValue("Composed in main.");

    await area(page, "header").click();
    await expect(page.locator("[data-block-key]")).toHaveCount(1);
    // Not a pull quote — the areas did not merge.
    await expect(page.getByRole("textbox", { name: "Quote" })).toHaveCount(0);
  });

  test("refuses a duplicate area name in words, rather than merging two areas", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/admin/templates");
    await page.getByRole("link", { name: templateName, exact: true }).click();

    await page.getByRole("button", { name: "Add area" }).click();
    const dialog = page.getByRole("dialog", { name: "Add an area" });
    await dialog.getByLabel("Name").fill("main");
    await dialog.getByRole("button", { name: "Add", exact: true }).click();

    // Adding an area that exists would silently replace its blocks with an
    // empty list, which is why the store refuses rather than overwrites.
    await expect(dialog.getByText(/already an area/i)).toBeVisible();
  });

  test("renames an area, and the blocks move with it", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/templates");
    await page.getByRole("link", { name: templateName, exact: true }).click();

    await area(page, "main").click();
    await page.getByRole("button", { name: "Rename area" }).click();

    const dialog = page.getByRole("dialog", { name: /Rename/ });
    await expect(dialog.getByLabel("Name")).toHaveValue("main");
    await dialog.getByLabel("Name").fill("body");
    await dialog.getByRole("button", { name: "Save", exact: true }).click();

    await expect(area(page, "body")).toHaveAttribute("aria-selected", "true");
    await save(page);

    await page.reload();
    await expect(area(page, "main")).toHaveCount(0);
    await area(page, "body").click();

    // The rename banks the open tree before moving it, so the blocks that
    // arrive under the new name are the ones that were on screen.
    await page.locator("[data-block-key]").first().click();
    await expect(page.getByRole("textbox", { name: "Quote" })).toHaveValue("Composed in main.");
  });

  test("removes an area, and the removal survives a reload", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/templates");
    await page.getByRole("link", { name: templateName, exact: true }).click();

    await area(page, "header").click();
    await page.getByRole("button", { name: "Remove area" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Remove area", exact: true })
      .click();

    // Removing the open area opens another, or the canvas would be showing a
    // tree that is no longer in the payload.
    await expect(area(page, "header")).toHaveCount(0);
    await expect(area(page, "body")).toHaveAttribute("aria-selected", "true");
    await save(page);

    await page.reload();
    await expect(area(page, "header")).toHaveCount(0);
    await expect(area(page, "body")).toBeVisible();

    // The last area cannot be removed — a template with none has no tree the
    // builder can open, so the control is not offered at all.
    await expect(page.getByRole("button", { name: "Remove area" })).toHaveCount(0);
  });

  test("publishes, and the list shows the areas it holds", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/templates");
    await page.getByRole("link", { name: templateName, exact: true }).click();

    await page.getByRole("button", { name: "Publish", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: /Publish/ });
    // Publish validates every area, and the bar totals every area — so this
    // "No issues" is a claim about the document, not about the open tree.
    await expect(dialog.getByText("No issues")).toBeVisible();
    await dialog.getByRole("button", { name: "Publish", exact: true }).click();

    await expect(page.getByText(/Published v\d+/)).toBeVisible({ timeout: 15_000 });

    await page.goto("/admin/templates");
    const row = page.getByRole("row", { name: new RegExp(templateName) });
    await expect(row).toContainText("body");
    await expect(row).toContainText("published");
  });

  test("cleans up", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/templates");

    await page
      .getByRole("row", { name: new RegExp(templateName) })
      .getByRole("button", { name: "Delete" })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Delete template", exact: true })
      .click();

    // By link role, not by text: the success toast repeats the name and
    // lingers, so a text locator would match the confirmation rather than the
    // row.
    await expect(page.getByRole("link", { name: templateName, exact: true })).toHaveCount(0);
  });
});
