import { expect, test, type Page } from "@playwright/test";

/**
 * Admin surfaces, captured in BOTH themes.
 *
 * playwright.config.ts has declared this project since Phase 0 with the note
 * that admin screens should be captured in both themes "so the on-brand admin
 * styling cannot drift". The admin has no reference screenshots in the handoff
 * bundle — it is net-new design on the `mg.*` tokens — so these baselines are
 * the only thing that will catch a regression in it.
 */
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

async function signIn(page: Page, theme: "light" | "dark") {
  // Set before the first navigation so the boot script in <head> applies the
  // theme before paint and no flash enters the screenshot.
  await page.addInitScript((t) => window.localStorage.setItem("mg-theme", t), theme);

  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin/);
}

for (const theme of ["light", "dark"] as const) {
  test.describe(`admin — ${theme}`, () => {
    test.skip(!email || !password, "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set");

    test(`dashboard`, async ({ page }) => {
      await signIn(page, theme);
      await page.goto("/admin");
      await page.evaluate(() => document.fonts.ready);

      await expect(page).toHaveScreenshot(`admin-dashboard-${theme}.png`, {
        fullPage: true,
        // The dashboard lists recently edited pages, whose contents change as
        // the suite runs; the chrome is what these baselines are guarding.
        mask: [page.locator("table")],
      });
    });

    test(`pages list`, async ({ page }) => {
      await signIn(page, theme);
      await page.goto("/admin/pages");
      await page.evaluate(() => document.fonts.ready);

      await expect(page).toHaveScreenshot(`admin-pages-${theme}.png`, {
        fullPage: true,
        mask: [page.locator("table")],
      });
    });
  });
}
