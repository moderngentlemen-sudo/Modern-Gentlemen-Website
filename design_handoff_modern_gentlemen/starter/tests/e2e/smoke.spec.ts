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

  test("the public archive exposes every article through pagination", async ({ page }) => {
    await page.goto("/style");
    await expect(page.getByRole("link", { name: "LOAD MORE STORIES" })).toHaveAttribute(
      "href",
      "/articles"
    );

    await page.goto("/articles");
    const firstPage = await page
      .locator('main a[href^="/article/"]')
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    expect(firstPage).toHaveLength(12);
    await page.getByRole("link", { name: "Older stories →" }).click();
    await expect(page).toHaveURL(/\/articles\?page=2$/);
    const secondPage = await page
      .locator('main a[href^="/article/"]')
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    expect(secondPage).toHaveLength(12);
    expect(secondPage.filter((href) => firstPage.includes(href))).toEqual([]);
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

  test("serves a 404 for an unknown product", async ({ page }) => {
    // The PDP used to answer 200 with an in-page "we couldn't find that
    // product" screen: a soft 404, and the kind search engines index and keep.
    // It could not do otherwise while the whole page was a client component —
    // `notFound()` needs a server module to sit in front of it.
    const response = await page.goto("/product/the-driving-glove");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: /This page doesn’t exist/ })).toBeVisible();
  });

  test("the store's products are in the served HTML, not only after hydration", async ({
    page,
    request,
  }) => {
    // `/shop` filters on `useSearchParams`, which opts its subtree out of
    // prerendering — so the grid ships in whatever the Suspense fallback
    // renders. When that fallback was the hero alone, the store's products
    // reached a crawler only through the flight payload, and **nothing in this
    // suite could tell**: every other test drives a real browser and waits for
    // hydration, which paints the grid either way.
    //
    // Hence a plain fetch, with no browser and no JavaScript, compared against
    // what the hydrated page shows. Comparing the two sets rather than counting
    // to a number keeps this honest as the catalogue changes — the claim is
    // "the server sends what the browser ends up with", not "sixteen".
    const html = await (await request.get("/shop")).text();
    const served = new Set(
      (html.match(/href="(\/product\/[a-z0-9-]+)"/g) ?? []).map((m) => m.slice(6, -1))
    );

    await page.goto("/shop");
    await expect(page.locator('main a[href^="/product/"]').first()).toBeVisible();
    // Scoped to `main`: the header's drawer and search overlay can hold product
    // links of their own depending on what is in the bag, and those are not
    // what this test is about.
    const hydrated = new Set(
      await page
        .locator('main a[href^="/product/"]')
        .evaluateAll((links) => links.map((a) => new URL((a as HTMLAnchorElement).href).pathname))
    );

    expect(hydrated.size).toBeGreaterThan(0);
    expect([...hydrated].filter((path) => !served.has(path))).toEqual([]);
  });
});
