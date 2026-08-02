import { expect, test } from "@playwright/test";

/**
 * Toolchain smoke test. Proves the app builds, serves, and renders its chrome
 * and section pipeline. The substantive journeys (builder, publishing,
 * revisions, ingestion) arrive with the phases that implement them.
 */
test.describe("public site smoke", () => {
  test("home page renders sections and chrome", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/modern gentlemen/i);
    await expect(page.locator("header").first()).toBeVisible();
    await expect(page.locator("footer").first()).toBeVisible();

    // The homepage is composed of ordered <section> blocks by SectionRenderer.
    expect(await page.locator("section").count()).toBeGreaterThan(0);
  });

  test("shop lists products and a product page opens", async ({ page }) => {
    await page.goto("/shop");
    const firstProduct = page.locator('a[href^="/product/"]').first();
    await expect(firstProduct).toBeVisible();

    await firstProduct.click();
    await expect(page).toHaveURL(/\/product\//);
  });

  test("theme toggle persists across a reload", async ({ page }) => {
    await page.goto("/");

    const initial = await page.locator("html").getAttribute("data-mgtheme");
    expect(initial).toBe("light"); // CLAUDE.md: light is the default

    await page.evaluate(() => {
      localStorage.setItem("mg-theme", "dark");
    });
    await page.reload();

    // The boot script must apply the stored theme before paint.
    await expect(page.locator("html")).toHaveAttribute("data-mgtheme", "dark");
  });

  test("serves a 404 for an unknown category", async ({ page }) => {
    const response = await page.goto("/not-a-real-category");
    expect(response?.status()).toBe(404);
  });
});
