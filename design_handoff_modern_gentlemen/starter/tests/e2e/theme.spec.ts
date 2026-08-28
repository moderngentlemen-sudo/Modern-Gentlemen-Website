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
 * "Background", "Border", "Accent fill" — and "Accent" is a strict substring of
 * three of them ("Accent fill", "Accent text", "Serif accent"), which is exactly
 * what the asymmetry assertions turn on.
 *
 * ⚠️ **"Accent" on its own is no longer a label at all, and that broke this
 * spec once.** The AA fix split the accent into a fill and an ink —
 * `--mg-accent` and `--mg-accent-ink` — so `THEME_TOKEN_LABELS.accent` became
 * "Accent fill" and a new "Accent text" appeared in all three contexts.
 * `getByLabel("Accent", { exact: true })` then resolved to zero elements, and
 * the failure read as a missing field rather than a renamed one. The two are
 * asserted separately below because their asymmetries differ: the fill is
 * dark-only, the ink is per-context everywhere.
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
    await expect(
      section(page, "Dark theme").getByLabel("Accent fill", { exact: true })
    ).toHaveCount(1);
    await expect(
      section(page, "Light theme").getByLabel("Band hairline", { exact: true })
    ).toHaveCount(1);

    // Absent where it deliberately does not.
    await expect(
      section(page, "Light theme").getByLabel("Accent fill", { exact: true })
    ).toHaveCount(0);
    await expect(
      section(page, "Dark bands").getByLabel("Band hairline", { exact: true })
    ).toHaveCount(0);

    // The ink is the opposite asymmetry, so it needs its own assertion: it is
    // per-context in ALL THREE, because the accent as text has to be brighter
    // on a dark ground and a dark band on a LIGHT page would otherwise inherit
    // light's `#c8102e` onto `#0d0d0d`. A refactor that emitted the fill and
    // the ink from one loop would satisfy every assertion above and still be
    // wrong.
    for (const context of ["Light theme", "Dark theme", "Dark bands"]) {
      await expect(section(page, context).getByLabel("Accent text", { exact: true })).toHaveCount(
        1
      );
    }
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
      .getByLabel("Accent fill", { exact: true })
      .fill("rgba(200, 16, 46, 1)");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();

    // `p[role="alert"]`, and both halves of that selector are load-bearing.
    //
    // `getByText(/accent/i)` matched four elements when this was written — the
    // Accent label plus "Serif accent" once per context — and matches more now
    // that the accent is two tokens, which is the point: a text locator over a
    // word this form repeats was never going to stay unique.
    // `getByRole("alert")` then matched two,
    // because **Next injects `<div role="alert" aria-live="assertive"
    // id="__next-route-announcer__">` into every page**. Grepping this repo for
    // `role="alert"` does not reveal it and never could: it belongs to the
    // framework, not the codebase. Any future admin spec reaching for an alert
    // role will hit the same thing.
    //
    // The element type is what separates them — the announcer is a `div`, this
    // is a `p` — and the toast is deliberately `role="status"`, so it does not
    // compete either.
    const alert = page.locator('p[role="alert"]');
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

    await section(page, "Dark theme").getByLabel("Accent fill", { exact: true }).fill("#c8102e");
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
