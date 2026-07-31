import { expect, test } from "@playwright/test";

/**
 * Screenshot regression net for the pixel-verified public site.
 *
 * These baselines exist to guard structural refactors that must not change what
 * renders — the Phase 4 route-group split being the first. A markup diff of the
 * prerendered HTML proves the DOM is unchanged; these prove the pixels are.
 * Capture the baselines BEFORE such a refactor, or they prove nothing.
 *
 * The hero and film sections play video, so their regions are masked: the frame
 * a video happens to be showing is not what these tests are about.
 */
const ROUTES = [
  { path: "/", name: "home" },
  { path: "/shop", name: "shop" },
  { path: "/about", name: "about" },
  { path: "/membership", name: "membership" },
  { path: "/style", name: "category-style" },
  { path: "/article/speed-considered", name: "article" },
  { path: "/product/the-driving-glove", name: "product" },
];

for (const theme of ["light", "dark"] as const) {
  test.describe(`public site — ${theme}`, () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    for (const route of ROUTES) {
      test(`${route.name} renders unchanged`, async ({ page }) => {
        // The boot script in <head> reads this before paint, so the first paint
        // is already in the right theme and no flash enters the screenshot.
        await page.addInitScript((t) => window.localStorage.setItem("mg-theme", t), theme);

        await page.goto(route.path);

        // Not `networkidle`: the hero and film sections stream video, so the
        // network never goes idle and the wait times out. What actually has to
        // settle before a stable screenshot is webfont loading — an unloaded
        // face re-flows every text run on the page.
        await page.evaluate(() => document.fonts.ready);

        // Masking a <video> hides its pixels but does not stop it: a playing
        // video keeps the page changing, and Playwright's "two consecutive
        // stable screenshots" check never converges on the homepage hero.
        await page.evaluate(() => {
          for (const v of document.querySelectorAll("video")) {
            v.pause();
            v.currentTime = 0;
          }
        });

        await expect(page).toHaveScreenshot(`${route.name}-${theme}.png`, {
          fullPage: true,
          mask: [page.locator("video")],
          timeout: 15_000,
        });
      });
    }
  });
}
