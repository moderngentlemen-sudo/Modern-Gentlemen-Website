import { expect, test } from "@playwright/test";

for (const width of [390, 1440]) {
  test(`footer meets the document edge on long and short pages at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const footer = page.locator('[data-site-chrome="footer"] footer');
    await expect(footer).toBeVisible();

    for (const short of [false, true]) {
      if (short) {
        // Isolate the shared layout from any particular published page length.
        await page.locator("[data-site-main]").evaluate((main) => {
          main.replaceChildren(document.createTextNode("Short page layout fixture"));
        });
      }
      for (const height of [900, 1000]) {
        await page.setViewportSize({ width, height });
        await expect
          .poll(() =>
            footer.evaluate((node) => {
              // Resize-driven layout can grow after the first scroll. Follow
              // the current bottom rather than retaining that stale position.
              const root = document.documentElement;
              window.scrollTo({ top: root.scrollHeight, behavior: "instant" });
              const bottom = node.getBoundingClientRect().bottom;
              return {
                viewportBottom: Math.round(bottom),
                spaceAfterFooter: Math.round(root.scrollHeight - (bottom + window.scrollY)),
              };
            })
          )
          .toEqual({ viewportBottom: height, spaceAfterFooter: 0 });
      }
    }
  });
}

test("mobile bottom canvas respects theme and footer overrides", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/");
  const root = page.locator("html");
  for (const theme of ["light", "dark"]) {
    await root.evaluate((node, value) => node.setAttribute("data-mgtheme", value), theme);
    await expect(root).toHaveCSS("background-color", "rgb(13, 13, 13)");
  }
  await root.evaluate((node) => node.setAttribute("data-mgtheme", "light"));
  const themeBackground = await page
    .locator("body")
    .evaluate((node) => getComputedStyle(node).backgroundColor);
  await page.locator("[data-site-main]").evaluate((main) => {
    const marker = document.createElement("div");
    marker.dataset.pagePresentation = "public";
    marker.dataset.pageMobileFooter = "hidden";
    main.append(marker);
  });
  await expect(page.locator('[data-site-chrome="footer"]')).toBeHidden();
  await expect(root).toHaveCSS("background-color", themeBackground);
  await page.locator('[data-page-mobile-footer="hidden"]').evaluate((node) => node.remove());
  await page
    .locator('[data-site-chrome="footer"]')
    .evaluate((node) => node.removeAttribute("data-default-footer"));
  await expect(root).toHaveCSS("background-color", themeBackground);
});
