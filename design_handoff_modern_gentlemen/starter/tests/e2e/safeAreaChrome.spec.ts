import { expect, test } from "@playwright/test";

test("public viewport opts into edge-to-edge layout without disabling zoom", async ({ page }) => {
  await page.goto("/");
  const viewport = page.locator('meta[name="viewport"]');
  await expect(viewport).toHaveCount(1);
  await expect(viewport).toHaveAttribute("content", /viewport-fit=cover/);
  await expect(viewport).not.toHaveAttribute("content", /user-scalable=no|maximum-scale=1/);
});

for (const { name, trigger, panel, top, bottom } of [
  { name: "Menu", trigger: "Open menu", panel: "aside", top: 66, bottom: 64 },
  { name: "Search", trigger: "Search", panel: null, top: 34, bottom: 24 },
  { name: "Bag", trigger: "Bag", panel: "aside", top: 34, bottom: 24 },
]) {
  test(`${name} paints to the viewport edge and reserves safe-area space`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/shop");
    // Synthetic inset coverage verifies our CSS arithmetic, not Safari's UI.
    await page.locator("html").evaluate((node) => {
      node.style.setProperty("--mg-safe-top", "34px");
      node.style.setProperty("--mg-safe-bottom", "24px");
    });
    await page.getByRole("button", { name: trigger, exact: true }).click();
    const dialog = page.getByRole("dialog", { name, exact: true });
    const content = panel ? dialog.locator(panel) : dialog;
    await expect(content).toHaveCSS("padding-top", `${top}px`);
    await expect(content).toHaveCSS("padding-bottom", `${bottom}px`);
    for (const height of [844, 640, 900]) {
      await page.setViewportSize({ width: 390, height });
      await expect
        .poll(() => dialog.evaluate((node) => Math.round(node.getBoundingClientRect().bottom)))
        .toBe(height);
    }
    const close = page.getByRole("button", { name: `Close ${name.toLowerCase()}`, exact: true });
    await expect(close).toBeInViewport();
    await close.click();
    await expect(dialog).toBeHidden();
    await expect(page.locator("body")).not.toHaveCSS("position", "fixed");
  });
}

test("footer adds the safe inset inside its dark surface", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator("html").evaluate((node) => node.style.setProperty("--mg-safe-bottom", "24px"));
  const footer = page.locator('[data-site-chrome="footer"] footer');
  await expect(footer).toHaveCSS("padding-bottom", "24px");
  await expect(footer).toHaveCSS("background-color", "rgb(13, 13, 13)");
});
