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

/** Its own scratch page, minted per attempt for the reason above. */
let dragTitle = "";
let dragSlug = "";

/**
 * Drags a library entry onto the canvas and drops it on `target` — a CSS
 * selector for an insertion point, since one is now identified by its container
 * as well as its index.
 *
 * **Stepped moves, not `page.dragAndDrop()`.** The `PointerSensor` activates
 * only after the pointer has travelled more than 6px, and it counts that over
 * real `pointermove` events — a single-shot helper jumps straight to the target
 * and typically does nothing at all while reporting success.
 *
 * The gap droppables are the other half of the timing: they do not exist until
 * the drag has *started*, so the target cannot be located before the press.
 * Waiting for one is therefore also the proof that the drag engaged, which is
 * why the count assertion sits mid-drag rather than at the end.
 *
 * ⚠️ **The target gap must already be in the viewport.** A gap below the fold
 * is attached, has a box, and silently drops nothing: a scripted drag jumps to
 * the coordinates and releases, giving dnd-kit's autoscroll — which is what
 * carries a *human* down a long page — no time to run. Found by driving this by
 * hand against a throwaway harness, where dropping onto the fourth gap of a
 * three-section page left the count unchanged. So the cases below stay near the
 * top of the canvas deliberately; a "drop at the very bottom of a long page"
 * test would need the drag to dwell at the edge instead.
 */
async function dragFromLibrary(page: Page, entry: RegExp, target: string) {
  const source = page.getByRole("button", { name: entry }).first();
  await source.scrollIntoViewIfNeeded();

  const from = await source.boundingBox();
  expect(from, "the library entry has no box to drag from").not.toBeNull();

  const startX = from!.x + from!.width / 2;
  const startY = from!.y + from!.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 40, startY, { steps: 8 });

  const gap = page.locator(target).first();
  await expect(gap).toHaveCount(1);

  const to = await gap.boundingBox();
  expect(to, "the insertion point has no box to drop onto").not.toBeNull();

  await page.mouse.move(to!.x + to!.width / 2, to!.y + to!.height / 2, { steps: 12 });
  await page.mouse.up();
}

/** A gap in the page's own list, rather than one inside a container. */
const rootGap = (index: number) => `[data-gap-index="${index}"]:not([data-gap-parent])`;

test.describe("page builder — drag from the library", () => {
  test.skip(!email || !password, "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set");
  test.describe.configure({ mode: "serial" });

  test("drops onto an empty page, then above the block already there", async ({ page }) => {
    await signIn(page);

    await page.goto("/admin/pages");
    const stamp = Date.now().toString(36);
    dragTitle = `E2E Drag ${stamp}`;
    dragSlug = `e2e-drag-${stamp}`;

    await page.getByRole("button", { name: "New page" }).click();
    const newPage = page.getByRole("dialog", { name: "New page" });
    await newPage.getByLabel("Title").fill(dragTitle);
    await newPage.getByLabel("Slug").fill(dragSlug);
    await newPage.getByRole("button", { name: "Create", exact: true }).click();

    await expect(page).toHaveURL(/\/admin\/pages\/[0-9a-f-]{36}$/);
    await expect(page.getByText("Add your first section")).toBeVisible();

    // The empty canvas is the case the hoisted DndContext repairs: before it,
    // a brand-new page had no drag context at all.
    await dragFromLibrary(page, /^Pull quote/i, rootGap(0));
    const blocks = page.locator("[data-block-key]");
    await expect(blocks).toHaveCount(1);

    // The trailing gap, then the leading one — the two ends of the index
    // arithmetic, in that order so both targets stay above the fold.
    await dragFromLibrary(page, /^Newsletter/i, rootGap(1));
    await expect(blocks).toHaveCount(2);

    await dragFromLibrary(page, /^Story band/i, rootGap(0));
    await expect(blocks).toHaveCount(3);

    // Order, not count. Appending every drop would satisfy all three counts
    // above and fail here — which is the whole point of the slice.
    await expect(blocks.nth(0).getByRole("button", { name: "Drag Story band" })).toHaveCount(1);
    await expect(blocks.nth(1).getByRole("button", { name: "Drag Pull quote" })).toHaveCount(1);
    await expect(blocks.nth(2).getByRole("button", { name: "Drag Newsletter" })).toHaveCount(1);

    // Dropped blocks are ordinary edits: they leave the document dirty and save
    // like any other, so the drag is not a UI-only illusion.
    await page.keyboard.press("ControlOrMeta+s");
    await expect(page.getByText(/^Saved /)).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(page.locator("[data-block-key]")).toHaveCount(3);
  });

  test("still inserts on click, which is the accessible path", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/pages");
    await page.getByRole("link", { name: dragTitle }).click();

    await expect(page.locator("[data-block-key]")).toHaveCount(3);

    // The library entries became drag sources in the same change. A click that
    // silently turned into a zero-distance drag would insert nothing, and a
    // click arriving *after* a drag would insert twice — so the count is the
    // assertion in both directions.
    await page
      .getByRole("button", { name: /^Timeline/i })
      .first()
      .click();
    await expect(page.locator("[data-block-key]")).toHaveCount(4);
  });

  test("nests a section inside a columns block", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/pages");
    await page.getByRole("link", { name: dragTitle }).click();

    const blocks = page.locator("[data-block-key]");
    const nested = page.locator("[data-block-key] [data-block-key]");

    /*
      Counted relative to whatever is already here, never against a fixed
      number. The preceding test inserts a block and does NOT save it, and
      autosave is debounced — so whether that block is still on the page when
      this one loads is a race, and asserting an absolute count made this test
      depend on the outcome of it. (It lost: the first CI run failed here
      expecting 4 and finding 3, before reaching any nesting at all.)
    */
    // ⚠️ Wait for the canvas before counting. The locator resolves to 0 while
    // the page hydrates — the failing run's log shows exactly that, "3 ×
    // locator resolved to 0 elements" — and a `before` of 0 would poison every
    // assertion below while looking like a nesting bug.
    await blocks.first().waitFor();
    const before = await blocks.count();
    await expect(nested).toHaveCount(0);

    // A container arrives empty and advertises its own drop target, which is
    // registered whatever is being dragged — the only way into an empty one.
    await dragFromLibrary(page, /^Columns/i, rootGap(0));
    await expect(blocks).toHaveCount(before + 1);

    const slot = page.locator("[data-gap-parent]");
    await expect(slot).toHaveCount(1);
    await expect(page.getByText(/drop a section here/i)).toBeVisible();

    // Into the container, not beside it: the assertion is the descendant
    // relationship, since a count alone cannot tell the two apart.
    await dragFromLibrary(page, /^Timeline/i, "[data-gap-parent]");
    await expect(blocks).toHaveCount(before + 2);
    await expect(nested).toHaveCount(1);

    // ⚠️ The nested block's own toolbar must work. The canvas kills pointer
    // events on links and buttons inside a section, and that selector is a
    // descendant one — applied to a container it would reach every nested
    // block's controls and disable them with nothing failing anywhere.
    // Scoped to the nested frame, not `getByRole(...).first()` across the page:
    // an unsaved Timeline from the previous test may or may not still be at the
    // root, and a page-wide match could pick that one's button instead.
    await nested
      .first()
      .getByRole("button", { name: /^Duplicate/ })
      .click();
    await expect(nested).toHaveCount(2);

    // A nested block is selectable and editable — `PropertiesPanel` used a root
    // `tree.find`, so before this it would have shown its empty state instead.
    await nested.first().click();
    await expect(page.getByRole("textbox", { name: "Heading" }).first()).toBeVisible();

    await page.keyboard.press("ControlOrMeta+s");
    await expect(page.getByText(/^Saved /)).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(nested).toHaveCount(2);
  });

  test("cleans up the page it created", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/pages");

    const row = page.getByRole("row").filter({ hasText: dragTitle });
    await row.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete page" }).click();

    await expect(page.getByRole("link", { name: dragTitle })).toHaveCount(0);
  });
});
