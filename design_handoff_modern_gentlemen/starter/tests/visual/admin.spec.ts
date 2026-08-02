import { existsSync } from "node:fs";
import { basename } from "node:path";

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

/**
 * Skip — visibly — when a baseline has never been captured.
 *
 * Unlike the public shots, these cannot be produced anywhere the repo is
 * merely checked out: they require a signed-in session, so a host needs both a
 * database and an admin account before it can take the first picture. CI has
 * both but cannot commit what it captures, and the dev container has neither.
 * Left alone, Playwright writes the actual and fails, which makes the job
 * permanently red for a reason no push can fix.
 *
 * A skip says the same thing without pretending it is a regression, and the
 * gate arms itself the moment a baseline lands next to the spec. The
 * `--update-snapshots` escape hatch is deliberate: without it, the guard would
 * also skip the run that is trying to create the baselines in the first place.
 */
function requireBaseline(name: string) {
  // Not destructured: snapshotPath lives on TestInfo's prototype, and a rest
  // spread would leave it behind.
  const info = test.info();
  const mode = info.config.updateSnapshots;
  const writing = mode === "all" || mode === "changed";
  const baseline = info.snapshotPath(name);

  test.skip(
    !writing && !existsSync(baseline),
    `No baseline for ${basename(baseline)}. Capture it on a host that can sign in — ` +
      `start a local Supabase stack, provision an admin, run ` +
      `\`npm run test:visual -- --update-snapshots\`, and commit the PNGs.`
  );
}

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
      requireBaseline(`admin-dashboard-${theme}.png`);
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
      requireBaseline(`admin-pages-${theme}.png`);
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
