import { expect, test, type Page } from "@playwright/test";

/**
 * Synced patterns, end to end — and specifically the half that was missing.
 *
 * `sync_mode: 'synced'` has existed as a column since `0003` and as a hard-coded
 * refusal since Phase 4, because **no public route expanded a `_ref`**: a synced
 * pattern rendered correctly in preview and vanished from the live site. Every
 * other kind of test would have passed throughout. The unit suite proves
 * `expandPatterns` substitutes blocks; the conformance suite proves `patternRef`
 * is a real block; neither can tell you whether a public route calls the
 * expansion at all.
 *
 * So the assertion this file exists for is the last one: **the pattern's blocks
 * are in the HTML a public page serves**, having been stored there as a pointer.
 * Everything above it is setup.
 *
 * ⚠️ **It composes `/grooming`, and the choice of category is deliberate.** The
 * two public surfaces that render a document's block tree are the homepage and
 * `/[category]`, and both `/` and `/style` are visual baselines — which run in
 * the same CI job immediately after this suite. A spec that failed halfway
 * through while holding an extra block on either would turn one failure into
 * five, with four of them pointing at the wrong thing entirely. `/grooming` is
 * a category page with no baseline, so the blast radius of a mid-spec failure
 * is this file.
 *
 * Credentials come from the environment; scripts/create-admin.ts provisions the
 * account and CI exports both variables.
 */
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

/** The unbaselined category this suite composes. See the header. */
const CATEGORY = "Grooming";
const CATEGORY_PATH = "/grooming";

/** Minted by the first test — a retry re-runs a serial group from the top. */
let patternName = "";
let patternKey = "";
let quote = "";

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin/);
}

/** Autosave debounces; Cmd/Ctrl+S flushes it and the bar reports when it lands. */
async function save(page: Page) {
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.getByText(/^Saved /)).toBeVisible({ timeout: 15_000 });
}

async function publish(page: Page) {
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: /Publish/ });
  await expect(dialog.getByText("No issues")).toBeVisible();
  await dialog.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByText(/Published v\d+/)).toBeVisible({ timeout: 15_000 });
}

/**
 * A pattern's entry in the builder's library rail.
 *
 * ⚠️ **Anchored regex, not an exact name, and this cost a CI run.** The rail's
 * button holds *two* spans — the pattern's name and a subtitle beneath it (its
 * description, or "1 section" when it has none) — so the button's accessible
 * name is `"<name> 1 section"`, and `{ name, exact: true }` could never match
 * it. The anchor is what keeps the loose match honest: it pins the start of the
 * name rather than matching a substring anywhere.
 *
 * Third time this family has bitten the suite: `getByLabel("Quote")` matched
 * six elements, `"Drag Column"` matched `"Drag Columns — layout"`, and the
 * templates spec's `/^Masthead/i` matched nothing because the label is "The
 * Masthead — team". **The lesson that keeps not transferring: read the markup
 * of the thing you are locating, not just its visible text.** A stamped name
 * contains no regex metacharacters, so interpolating it is safe.
 */
function libraryPattern(page: Page, name: string) {
  return page.getByRole("button", { name: new RegExp(`^${name}`) });
}

/**
 * **This attempt's** synced-pattern card on the canvas.
 *
 * ⚠️ Scoped twice, and the two scopes are for different reasons.
 *
 * `main` disambiguates the card from the **properties panel**: inserting a
 * reference selects it, so the panel shows the block's manifest label — which
 * is also "Synced pattern" — while the canvas card carries the same words as an
 * eyebrow. The canvas is the builder's only `<main>`; the rail and the panel
 * are `<aside>`.
 *
 * The block frame carrying `name` disambiguates it from **a previous attempt's
 * card**, and that one cost a CI run as a phantom flake. This group is serial,
 * so a failure anywhere in it retries the whole group from the top — but the
 * category it composes is shared fixture data, and attempt 1 published its
 * reference before the later spec failed. Attempt 2 therefore opens a page that
 * already has a card, inserts a second, and dies on a strict-mode violation
 * reporting two identical eyebrows. The spec looks broken; what is actually
 * broken is whatever failed three tests later.
 *
 * `patternName` is stamped per attempt, so filtering the frame by it picks this
 * attempt's card and ignores any left behind — which is also what makes the
 * `toHaveCount(0)` after detaching mean "*mine* is gone" rather than "none
 * exist".
 */
function refFrame(page: Page, name: string) {
  return page.getByRole("main").locator("[data-block-key]").filter({ hasText: name });
}

function refCard(page: Page, name: string) {
  return refFrame(page, name).getByText("Synced pattern", { exact: true });
}

/** The category builder is reached from the taxonomy screen, which owns the list. */
async function openCategory(page: Page) {
  await page.goto("/admin/taxonomy");
  await page
    .getByRole("row", { name: new RegExp(CATEGORY) })
    .getByRole("link", { name: "Edit layout" })
    .click();
  await expect(page).toHaveURL(/\/admin\/categories\/[0-9a-f-]{36}$/);
}

test.describe("synced patterns", () => {
  test.skip(!email || !password, "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set");
  test.describe.configure({ mode: "serial" });

  test("creates a synced pattern, composes it and publishes it", async ({ page }) => {
    await signIn(page);

    const stamp = Date.now().toString(36);
    patternName = `E2E Synced ${stamp}`;
    patternKey = `e2e-synced-${stamp}`;
    quote = `Synced at ${stamp}.`;

    await page.goto("/admin/patterns");
    await page.getByRole("button", { name: "New pattern" }).click();

    const dialog = page.getByRole("dialog", { name: "New pattern" });
    await dialog.getByLabel("Name").fill(patternName);
    await dialog.getByLabel("Key").fill(patternKey);
    await dialog.getByLabel("Inserting it").selectOption("synced");
    await dialog.getByRole("button", { name: "Create", exact: true }).click();

    await expect(page).toHaveURL(/\/admin\/patterns\/[0-9a-f-]{36}$/);

    await page
      .getByRole("button", { name: /^Pull quote/i })
      .first()
      .click();
    await page.getByRole("textbox", { name: "Quote" }).fill(quote);
    await save(page);

    // ⚠️ Published, not merely saved. `expandPublicPatterns` reads
    // `published_data` and nothing else — it must, or one editor's half-written
    // draft would appear on every page using the pattern — so an unpublished
    // synced pattern is a gap on the live site. The public assertion below is
    // the one that would fail if this step were skipped.
    await publish(page);
  });

  test("inserts as a reference rather than a copy, and says what it is", async ({ page }) => {
    await signIn(page);
    await openCategory(page);

    const before = await page.locator("[data-block-key]").count();

    await libraryPattern(page, patternName).click();

    // **One** block, not the pattern's blocks copied in. That single node is the
    // whole difference between synced and detachable at the tree level.
    await expect(page.locator("[data-block-key]")).toHaveCount(before + 1);
    await expect(refCard(page, patternName)).toBeVisible();
    await expect(page.getByText(/substituted when the page renders/)).toBeVisible();

    // The canvas shows the reference, never the pattern's content — those blocks
    // belong to another document and could not be edited here.
    await expect(page.getByRole("textbox", { name: "Quote" })).toHaveCount(0);

    await save(page);
    await publish(page);
  });

  /**
   * The assertion the whole slice exists for.
   *
   * `/grooming` is statically rendered and publishing the category revalidated
   * it. If `expandPublicPatterns` were not wired in — or ran *after*
   * `resolveBindings`, or reused the repository read that selects `draft_data`
   * and gets refused by `0020`'s column grant — this page would serve a gap and
   * everything upstream would still look correct.
   */
  test("renders the pattern's blocks on the public page", async ({ page }) => {
    await page.goto(CATEGORY_PATH);
    await expect(page.getByText(quote)).toBeVisible();
  });

  /**
   * The property that makes it *synced*: editing the pattern changes a page
   * nobody touched. A detachable pattern can never do this.
   */
  test("editing the pattern updates the page that references it", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/patterns");
    await page.getByRole("link", { name: patternName, exact: true }).click();

    quote = `${quote} Edited.`;
    await page.locator("[data-block-key]").first().click();
    await page.getByRole("textbox", { name: "Quote" }).fill(quote);
    await save(page);

    // Publishing the *pattern* is what refreshes the public site. The category
    // is not opened, not edited and not republished.
    await publish(page);

    await page.goto(CATEGORY_PATH);
    await expect(page.getByText(quote)).toBeVisible();
  });

  test("detaching turns the reference into editable blocks", async ({ page }) => {
    await signIn(page);
    await openCategory(page);

    /*
      ⚠️ **Scoped to this attempt's frame, and the button used to be dead.**

      `PatternRefCard` rendered inside the canvas frame's leaf navigation
      killer — `[&_button]:pointer-events-none`, which exists to stop a
      *section's* own links navigating away inside the builder. A reference
      card renders no section; its only button is this one. So the control was
      visible, enabled, focusable and unclickable, and Playwright reported it
      as `<div class="mt-4">…</div> intercepts pointer events` — the card's own
      wrapper, swallowing the click. A person would have found no error at all,
      just a button that does nothing. `Canvas.tsx` exempts a ref from the
      killer now; this line is what proves it.
    */
    await refFrame(page, patternName).getByRole("button", { name: "Detach a copy" }).click();

    // The card is gone and the blocks are real: a Quote field exists on the
    // canvas now, which is exactly what could not be edited a moment ago.
    await expect(refCard(page, patternName)).toHaveCount(0);
    await page.getByRole("textbox", { name: "Quote" }).first().click();
    await expect(page.getByRole("textbox", { name: "Quote" }).first()).toHaveValue(quote);

    // Persisted, so the next test faces one known state rather than a race with
    // the autosave debounce — and so the detach is proven to survive a save
    // rather than only to have happened in the store.
    await save(page);
    await publish(page);
  });

  test("cleans up", async ({ page }) => {
    await signIn(page);

    // `/grooming` is shared fixture data, so the block this suite added has to
    // come back out — and be republished, or the live page keeps serving it.
    await openCategory(page);

    /*
      Scoped to the block's own frame and matched on the *verb*, not the block
      name. A toolbar button is named `Delete ${label}` where the label is the
      manifest's — except on a reference, where the card shows the **pattern's**
      name instead. So "Delete Pull quote" is right only if the detach test got
      that far; after an earlier failure this could still be the reference. One
      locator handles both, and neither depends on guessing a label.
    */
    const block = page
      .locator("[data-block-key]")
      .filter({ hasText: new RegExp(`${quote}|${patternName}`) })
      .first();

    if ((await block.count()) > 0) {
      await block.click();
      await block
        .getByRole("button", { name: /^Delete / })
        .first()
        .click();
      await save(page);
      await publish(page);
    }

    await page.goto("/admin/patterns");
    await page
      .getByRole("row", { name: new RegExp(patternName) })
      .getByRole("button", { name: "Delete" })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Delete pattern", exact: true })
      .click();

    await expect(page.getByRole("link", { name: patternName, exact: true })).toHaveCount(0);
  });
});
