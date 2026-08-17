import { expect, test, type Page } from "@playwright/test";

/**
 * Patterns, end to end.
 *
 * The patterns admin has had no E2E coverage since it was built — the suite
 * reaches pages, articles, products, media, navigation, theme and integrations,
 * and never this. The rename is what finally needed it: the integration test
 * beside it drives the repository with the service-role client, which **bypasses
 * RLS entirely**, so nothing there proves an editor's own session may perform
 * the write. This does, because it is a browser holding a real session.
 *
 * Credentials come from the environment; scripts/create-admin.ts provisions the
 * account and CI exports both variables.
 */
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

/** Minted by the first test — a retry re-runs a serial group from the top. */
let patternName = "";
let patternKey = "";
let renamedName = "";
let renamedKey = "";
/** A second pattern, so the collision case has something real to collide with. */
let otherName = "";
let otherKey = "";

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin/);
}

test.describe("patterns", () => {
  test.skip(!email || !password, "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set");
  test.describe.configure({ mode: "serial" });

  async function createPattern(page: Page, name: string, key: string) {
    await page.goto("/admin/patterns");
    await page.getByRole("button", { name: "New pattern" }).click();

    const dialog = page.getByRole("dialog", { name: "New pattern" });
    await dialog.getByLabel("Name").fill(name);
    // The key auto-fills from the name; overwritten so the fixture is
    // predictable rather than dependent on how `slugify` treats the stamp.
    await dialog.getByLabel("Key").fill(key);
    await dialog.getByRole("button", { name: "Create", exact: true }).click();

    // Creating opens the builder for the new pattern.
    await expect(page).toHaveURL(/\/admin\/patterns\/[0-9a-f-]{36}$/);
  }

  test("creates one", async ({ page }) => {
    await signIn(page);

    const stamp = Date.now().toString(36);
    patternName = `E2E Pattern ${stamp}`;
    patternKey = `e2e-pattern-${stamp}`;
    renamedName = `E2E Renamed ${stamp}`;
    renamedKey = `e2e-renamed-${stamp}`;
    otherName = `E2E Other ${stamp}`;
    otherKey = `e2e-other-${stamp}`;

    await createPattern(page, patternName, patternKey);
    // `scripts/seed.ts` writes no patterns at all, so nothing exists to collide
    // with unless this test makes it.
    await createPattern(page, otherName, otherKey);
  });

  test("renames it — both the name and the key", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/patterns");

    await page
      .getByRole("row", { name: new RegExp(patternName) })
      .getByRole("button", { name: "Rename" })
      .click();

    const dialog = page.getByRole("dialog");
    // Opens holding what is there, rather than empty: a rename is an edit of an
    // existing row, not a second create.
    await expect(dialog.getByLabel("Name")).toHaveValue(patternName);
    await expect(dialog.getByLabel("Key")).toHaveValue(patternKey);

    await dialog.getByLabel("Name").fill(renamedName);
    await dialog.getByLabel("Key").fill(renamedKey);
    await dialog.getByRole("button", { name: "Save", exact: true }).click();

    await expect(page.getByText("Pattern renamed")).toBeVisible();

    // The row shows both new values — which is the whole point, since a pattern
    // could not be renamed at all before `renameDocument`: getting the name
    // wrong meant deleting it and losing its history.
    await page.reload();
    await expect(page.getByRole("link", { name: renamedName, exact: true })).toBeVisible();
    await expect(page.getByText(renamedKey, { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: patternName, exact: true })).toHaveCount(0);
  });

  test("refuses a key another pattern already holds, in words", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/patterns");

    await page
      .getByRole("row", { name: new RegExp(renamedName) })
      .getByRole("button", { name: "Rename" })
      .click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Key").fill(otherKey);
    await dialog.getByRole("button", { name: "Save", exact: true }).click();

    // A raw 23505 would reach the editor as a constraint string; the service
    // names the field by the word this type actually uses — "key", not "slug".
    await expect(dialog.getByText(/key .* is already in use by another pattern/i)).toBeVisible();
  });

  test("cleans up", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/patterns");

    for (const name of [renamedName, otherName]) {
      await page
        .getByRole("row", { name: new RegExp(name) })
        .getByRole("button", { name: "Delete" })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Delete pattern", exact: true })
        .click();

      // By link role, not by text: the success toast repeats the name and
      // lingers, so a text locator would match the confirmation rather than the
      // row.
      await expect(page.getByRole("link", { name, exact: true })).toHaveCount(0);
    }
  });
});
