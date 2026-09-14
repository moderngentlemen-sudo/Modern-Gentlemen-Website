import { expect, test } from "@playwright/test";

for (const width of [390, 1440]) {
  test(`search finds article prefixes at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    const input = page.getByRole("textbox", { name: "Search editorial and store" });
    const article = page.locator('#mg-search-overlay a[href="/article/speed-considered"]');

    for (const query of ["spee", "speed cons", "speed considered"]) {
      const response = page.waitForResponse(
        (r) =>
          r.url().includes("/api/search/articles?") &&
          new URL(r.url()).searchParams.get("q") === query
      );
      await input.fill(query);
      const payload = await (await response).json();
      expect(payload.results).toEqual(
        expect.arrayContaining([expect.objectContaining({ href: "/article/speed-considered" })])
      );
      await expect(article.first()).toBeVisible();
    }
    await article.first().click();
    await expect(page).toHaveURL(/\/article\/speed-considered$/);
    await expect(
      page.getByRole("heading", { name: "Speed, Considered", exact: true })
    ).toBeVisible();
  });

  test(`search reuses its prepared shell at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const overlay = page.locator("#mg-search-overlay");
    await expect(overlay).toBeAttached();
    await expect(overlay).toBeHidden();
    const field = await overlay.locator("input").elementHandle();
    const trigger = page.getByRole("button", { name: "Search", exact: true });

    for (let attempt = 0; attempt < 2; attempt++) {
      await trigger.click();
      await expect(overlay).toBeVisible();
      await expect(page.getByRole("textbox", { name: "Search editorial and store" })).toBeFocused();
      expect(
        await field!.evaluate((node) => node === document.querySelector("#mg-search-overlay input"))
      ).toBe(true);
      await page.keyboard.press("Escape");
      await expect(overlay).toBeHidden();
      await expect(trigger).toBeFocused();
    }
  });
}
