import { expect, test } from "@playwright/test";

for (const { name, trigger } of [
  { name: "Menu", trigger: "Open menu" },
  { name: "Search", trigger: "Search" },
  { name: "Bag", trigger: "Bag" },
]) {
  test(`${name} canvas follows the open pane and restores the footer`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/shop");
    const root = page.locator("html");
    const body = page.locator("body");
    const main = page.locator("[data-site-main]");
    for (const theme of ["light", "dark"]) {
      await root.evaluate((node, value) => node.setAttribute("data-mgtheme", value), theme);
      const pageColor = theme === "light" ? "rgb(244, 244, 244)" : "rgb(13, 13, 13)";
      const paneColor =
        name === "Bag"
          ? theme === "light"
            ? "rgb(255, 255, 255)"
            : "rgb(19, 19, 21)"
          : "rgb(13, 13, 13)";
      await expect(body).toHaveCSS("background-color", "rgb(13, 13, 13)");
      await expect(main).toHaveCSS("background-color", pageColor);
      await page.getByRole("button", { name: trigger, exact: true }).click();
      const dialog = page.getByRole("dialog", { name, exact: true });
      await expect(dialog).toBeVisible();
      await expect(body).toHaveCSS("background-color", paneColor);
      await expect(main).toHaveCSS("background-color", pageColor);
      await page.getByRole("button", { name: `Close ${name.toLowerCase()}`, exact: true }).click();
      await expect(dialog).toBeHidden();
      await expect(body).toHaveCSS("background-color", "rgb(13, 13, 13)");
    }
    // The footer is deliberately hidden: a closed, prepared search shell must
    // not leave a dark canvas behind, and open panes must still own their tint.
    await root.evaluate((node) => node.setAttribute("data-mgtheme", "light"));
    await main.evaluate((node) => {
      const marker = document.createElement("div");
      marker.dataset.pagePresentation = "public";
      marker.dataset.pageMobileFooter = "hidden";
      node.append(marker);
    });
    await expect(body).toHaveCSS("background-color", "rgb(244, 244, 244)");
    await page.getByRole("button", { name: trigger, exact: true }).click();
    await expect(body).toHaveCSS(
      "background-color",
      name === "Bag" ? "rgb(255, 255, 255)" : "rgb(13, 13, 13)"
    );
    await page.getByRole("button", { name: `Close ${name.toLowerCase()}`, exact: true }).click();
    await expect(body).toHaveCSS("background-color", "rgb(244, 244, 244)");
  });
}
