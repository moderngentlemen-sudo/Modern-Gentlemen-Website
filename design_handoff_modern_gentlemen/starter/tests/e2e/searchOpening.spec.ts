import { expect, test } from "@playwright/test";

for (const width of [390, 1440]) {
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
