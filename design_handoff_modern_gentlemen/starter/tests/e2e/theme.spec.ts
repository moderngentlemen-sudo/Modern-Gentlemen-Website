import { expect, test, type Page } from "@playwright/test";

/**
 * The theme admin, end to end.
 *
 * What this proves that no unit test can: that `theme.write` is asserted through
 * a real session against real RLS, that a saved draft survives a round trip
 * through `theme_settings.draft_data`, and — the part that would be easy to get
 * wrong — that the two token asymmetries reach the *form*, not just the emitter.
 *
 * **It never publishes.** There is one `theme_settings` row, `key='default'`,
 * and the visual suite reads its published payload from the same project. A spec
 * that published a stamped colour and then failed before reverting would move
 * all 16 baselines and the failure would look like a CSS regression. Publishing
 * is covered by `tests/integration/publicTheme.test.ts`, against a throwaway
 * row. The draft is safe to write here precisely because the public site never
 * reads it.
 *
 * **Locators are exact from the start.** CI run #49's lesson, and this spec is
 * as exposed to it as the navigation one: the token labels are short words —
 * "Background", "Border", "Accent" — and "Accent" is a strict substring of
 * "Serif accent", which is the exact pair the asymmetry assertions turn on.
 *
 * Credentials come from the environment; scripts/create-admin.ts provisions the
 * account and CI exports both variables.
 */
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

/** The value this run writes. Minted inside the first test, not at module scope:
 *  Playwright retries a serial group from its first test, and a literal would
 *  survive the retry and make "did it persist?" pass vacuously. */
let stamp = "";

/** The value the draft is restored to at the end. Light surface is `#ffffff`. */
const LIGHT_SURFACE_DEFAULT = "#ffffff";

/**
 * One `PanelSection`, by its collapse toggle's accessible name.
 *
 * Scoped to `section` and to the *button*, not to any element containing the
 * text: `PanelSection` renders a `<section>` whose header is a toggle button
 * named for the title, and the sections are siblings. Filtering on `getByText`
 * instead would match every ancestor `div` as well, and the count assertions
 * below would then be counting the same control several times over.
 */
function section(page: Page, title: string) {
  return page
    .locator("section")
    .filter({ has: page.getByRole("button", { name: title, exact: true }) });
}

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin/);
}

test.describe("theme", () => {
  test.skip(!email || !password, "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set");
  test.describe.configure({ mode: "serial" });

  test("reaches the theme editor from the admin nav", async ({ page }) => {
    stamp = `#${Math.floor(Math.random() * 0x1000000)
      .toString(16)
      .padStart(6, "0")}`;

    await signIn(page);
    await page.getByRole("link", { name: "Theme", exact: true }).click();

    await expect(page).toHaveURL(/\/admin\/theme$/);
    await expect(page.getByRole("heading", { name: "Theme", exact: true })).toBeVisible();
  });

  test("renders one section per context", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/theme");

    for (const title of ["Light theme", "Dark theme", "Dark bands"]) {
      await expect(page.getByText(title, { exact: true })).toBeVisible();
    }
  });

  /**
   * The two asymmetries, asserted where an editor would see them.
   *
   * `TOKENS_BY_CONTEXT` drives both the form and the emitted stylesheet, so this
   * is the same guarantee `theme.test.ts` checks in the CSS — but a refactor
   * that reintroduced a per-context loop in the component would pass that unit
   * test and fail here.
   */
  test("omits the accent from light and the hairline from dark bands", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/theme");

    // Present where globals.css declares them.
    await expect(section(page, "Dark theme").getByLabel("Accent", { exact: true })).toHaveCount(1);
    await expect(
      section(page, "Light theme").getByLabel("Band hairline", { exact: true })
    ).toHaveCount(1);

    // Absent where it deliberately does not.
    await expect(section(page, "Light theme").getByLabel("Accent", { exact: true })).toHaveCount(0);
    await expect(
      section(page, "Dark bands").getByLabel("Band hairline", { exact: true })
    ).toHaveCount(0);
  });

  /**
   * Before the writing tests, deliberately.
   *
   * A rejected save writes nothing, so if this one fails the serial group aborts
   * with the row untouched. Ordered after them — as it first was — a failure
   * here skipped the restore test and left the stamped draft behind.
   */
  test("rejects a non-hex accent with a message naming the field", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/theme");

    // The one token that cannot take rgba(): it also drives --mg-accent-rgb.
    await section(page, "Dark theme")
      .getByLabel("Accent", { exact: true })
      .fill("rgba(200, 16, 46, 1)");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();

    // By role, not by text. `getByText(/accent/i)` matched four elements — the
    // Accent label plus "Serif accent" once per context — which is CI run #49's
    // lesson, committed in this file's own header and then walked into one
    // assertion later. The error paragraph is the only `role="alert"` on the
    // page; the toast is deliberately `role="status"`.
    const alert = page.getByRole("alert");
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("accent");
  });

  test("saves a draft and reads it back", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/theme");

    const field = section(page, "Light theme").getByLabel("Surface", { exact: true });
    await field.fill(stamp);

    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(page.getByText("Draft saved", { exact: true })).toBeVisible();

    await page.reload();
    await expect(section(page, "Light theme").getByLabel("Surface", { exact: true })).toHaveValue(
      stamp
    );
  });

  /** Leaves the row as it was found, so a later run and the visual suite are
   *  unaffected by this one. */
  test("restores the default draft", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/theme");

    await section(page, "Dark theme").getByLabel("Accent", { exact: true }).fill("#c8102e");
    await section(page, "Light theme")
      .getByLabel("Surface", { exact: true })
      .fill(LIGHT_SURFACE_DEFAULT);

    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(page.getByText("Draft saved", { exact: true })).toBeVisible();

    await page.reload();
    await expect(section(page, "Light theme").getByLabel("Surface", { exact: true })).toHaveValue(
      LIGHT_SURFACE_DEFAULT
    );
  });
});
