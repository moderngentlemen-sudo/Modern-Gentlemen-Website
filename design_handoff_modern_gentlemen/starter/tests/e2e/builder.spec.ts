import { expect, test, type Locator, type Page } from "@playwright/test";

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
/**
 * Drag one element onto another with the mouse. For an existing block, the
 * target may be a gap that appears after the drag activates; this is how the
 * builder chooses an exact position inside a non-empty container.
 *
 * Shared by the library drags and by block-onto-block reordering. Horizontal
 * column rows still show no insertion strips, because they would become grid
 * cells (see `Column.tsx`); columns continue to reorder by dropping onto a
 * sibling.
 */
async function dragOnto(page: Page, source: Locator, target: Locator) {
  await source.scrollIntoViewIfNeeded();

  const from = await source.boundingBox();
  expect(from, "the drag source has no box to drag from").not.toBeNull();

  const startX = from!.x + from!.width / 2;
  const startY = from!.y + from!.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 40, startY, { steps: 8 });

  await expect(target).toHaveCount(1);

  const to = await target.boundingBox();
  expect(to, "the drop target has no box to drop onto").not.toBeNull();

  await page.mouse.move(to!.x + to!.width / 2, to!.y + to!.height / 2, { steps: 12 });
  await page.mouse.up();

  /*
    ⚠️ The first click after a drop is swallowed, and this wait is not padding.

    On activation dnd-kit adds a capture-phase `click` listener on the document
    that stops propagation — the very mechanism that stops a completed drag from
    also firing the library entry's click and inserting twice. It removes that
    listener on a `setTimeout(…, 50)` after the drag ends, so for 50ms *every*
    click anywhere is discarded, including one on a block's own toolbar.

    Clicking inside that window looks like a click that worked and did nothing:
    Playwright reports success, the handler never runs, and only the assertion
    afterwards fails. It cost three CI runs, flaky each time, all at the same
    line. 150ms clears the window with room for a slow runner.
  */
  await page.waitForTimeout(150);
}

/** The library rail's entry for `entry`, dropped onto `target`. */
async function dragFromLibrary(page: Page, entry: RegExp, target: string | Locator) {
  await dragOnto(
    page,
    page.getByRole("button", { name: entry }).first(),
    // A Locator rather than a selector when the target is "the second column" —
    // which cannot be written as a string without knowing its minted key.
    typeof target === "string" ? page.locator(target).first() : target
  );
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

    /*
      A row arrives holding two columns — `insertChildren` on the manifest — so
      it is three frames, not one, and it advertises a drop target per column.

      ⚠️ Two columns is the whole point of this test. It was written when the
      row held one flat list and a section's *index* decided which cell it
      landed in; the reported symptom was that after filling the first column,
      dragging into a different one did nothing at all, because the empty space
      was not a droppable. Aiming at each column in turn is what proves that
      gone.
    */
    await dragFromLibrary(page, /^Columns/i, rootGap(0));
    await expect(blocks).toHaveCount(before + 3);
    await expect(nested).toHaveCount(2);

    const emptyColumns = page.locator("[data-gap-parent]");
    await expect(emptyColumns).toHaveCount(2);
    await expect(page.getByText(/drop a section here/i).first()).toBeVisible();

    // Into the first column, not beside it: the assertion is the descendant
    // relationship, since a count alone cannot tell the two apart.
    await dragFromLibrary(page, /^Timeline/i, emptyColumns.first());
    await expect(blocks).toHaveCount(before + 4);
    await expect(nested).toHaveCount(3);

    // ⚠️ **The reported bug.** The second column is still empty, so it still
    // advertises its own target — and a section aimed at it lands there rather
    // than nowhere.
    const secondColumnGap = page.locator("[data-gap-parent]").last();
    await dragFromLibrary(page, /^Newsletter/i, secondColumnGap);
    await expect(blocks).toHaveCount(before + 5);
    await expect(nested).toHaveCount(4);

    /*
      Existing blocks use the same gaps as library drags. Move the nested
      Newsletter from the second column to the front of the first column. The
      gap does not exist before activation, so `dragOnto` waits for it after
      the block handle has crossed the sensor threshold.
    */
    const firstColumn = page
      .getByRole("button", { name: "Drag Column", exact: true })
      .first()
      .locator("xpath=ancestor::*[@data-block-key][1]");
    const secondColumn = page
      .getByRole("button", { name: "Drag Column", exact: true })
      .last()
      .locator("xpath=ancestor::*[@data-block-key][1]");
    const firstColumnOrder = () =>
      firstColumn
        .locator("[data-block-key]")
        .evaluateAll((frames) =>
          frames.map(
            (frame) =>
              frame.querySelector('button[aria-label^="Drag "]')?.getAttribute("aria-label") ?? "?"
          )
        );
    await dragOnto(
      page,
      secondColumn.getByRole("button", { name: "Drag Newsletter", exact: true }),
      firstColumn.locator('[data-gap-index="0"]')
    );
    await expect
      .poll(firstColumnOrder, { timeout: 10_000 })
      .toEqual(["Drag Newsletter", "Drag Timeline — a brief history"]);

    /*
      ⚠️ The nested block's own toolbar must work. The canvas kills pointer
      events on links and buttons inside a section, and that selector is a
      descendant one — applied to a container it would reach every nested
      block's controls and disable them with nothing failing anywhere. It now
      has two levels of container to get through, row and column, so this
      matters more than it did.

      Scoped to the Timeline's own frame rather than `nested.first()`, which is
      a column now: duplicating a column would prove something else entirely,
      and an unsaved Timeline from the previous test may still be at the root,
      so a page-wide match could pick that one's button instead.
    */
    // After the move Newsletter is deliberately first, so a positional
    // triple-descendant locator would duplicate the wrong block. Anchor this
    // assertion to the Timeline handle itself instead.
    const timeline = firstColumn
      .getByRole("button", { name: /^Drag Timeline/i })
      .locator("xpath=ancestor::*[@data-block-key][1]");
    await timeline.getByRole("button", { name: /^Duplicate/ }).click();
    await expect(nested).toHaveCount(5);

    // A nested block is selectable and editable — `PropertiesPanel` used a root
    // `tree.find`, so before this it would have shown its empty state instead.
    // Two levels deep now, which is the same code path and a longer walk.
    await timeline.click();
    await expect(page.getByRole("textbox", { name: "Heading" }).first()).toBeVisible();

    await page.keyboard.press("ControlOrMeta+s");
    await expect(page.getByText(/^Saved /)).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(nested).toHaveCount(5);
  });

  test("swaps two columns by dragging one onto the other", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/pages");
    await page.getByRole("link", { name: dragTitle }).click();

    /*
      A row shows no insertion strips — they would become grid cells — so a
      column is reordered block-onto-block, which is what `dropTargetFor`
      exists to make land where it looks.

      ⚠️ Two things this proves that unit tests cannot. First, that a column's
      own drag handle is reachable at all. Second, that dragging FORWARD moves
      anything: `moveByKey` used to insert the active at the target's index
      after removing it, which for a forward drag is the index the active just
      vacated — so the block sprang back and nothing failed anywhere.
    */
    const deepest = page.locator("[data-block-key] [data-block-key] [data-block-key]");
    const contents = () =>
      deepest.evaluateAll((frames) =>
        frames.map(
          (frame) =>
            frame.querySelector('button[aria-label^="Duplicate "]')?.getAttribute("aria-label") ??
            "?"
        )
      );

    await deepest.first().waitFor();
    const before = await contents();
    // The preceding nesting test now persists Newsletter ahead of Timeline in
    // the first column. Either label proves the row is populated; the assertion
    // after the swap is the one that proves the columns changed places.
    expect(before.some((label) => /Newsletter|Timeline/.test(label))).toBe(true);

    /*
      ⚠️ `exact` is load-bearing. `getByRole`'s `name` matches a **substring**
      by default, and the row's own handle is "Drag Columns — layout" — which
      contains "Drag Column". Without it this resolved to three handles, the
      row's included, and dragging the row onto a column would have been a very
      different test. The same trap this file records for `getByLabel`.
    */
    const handles = page.getByRole("button", { name: "Drag Column", exact: true });
    await expect(handles).toHaveCount(2);
    await dragOnto(page, handles.first(), handles.last());

    // The Timeline's column now comes second, so the Newsletter's is first.
    await expect.poll(async () => (await contents())[0], { timeout: 10_000 }).toMatch(/Newsletter/);

    await page.keyboard.press("ControlOrMeta+s");
    await expect(page.getByText(/^Saved /)).toBeVisible({ timeout: 15_000 });

    // Persisted, not just moved on screen.
    await page.reload();
    await deepest.first().waitFor();
    expect((await contents())[0]).toMatch(/Newsletter/);
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
