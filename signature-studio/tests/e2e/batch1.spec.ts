import { expect, test, type Page } from "@playwright/test";
import { configureTestHost, shot } from "./helpers";

const preview = (page: Page) => page.locator('[data-testid="preview"]');
const GIF =
  "R0lGODlhPAAUAIEAAMgQLgAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQAHgAAACwAAAAAPAAUAAAIOgABCBxIsKDBgwgTKlzIsKHDhxAjSpxIsaLFixgzatzIsaPHjyBDihxJsqTJkyhTqlzJsqXLlzAxBgQAIfkEAR4AAQAsAAAAADwAFACBFBQUAAAAAAAAAAAACDoAAQgcSLCgwYMIEypcyLChw4cQI0qcSLGixYsYM2rcyLGjx48gQ4ocSbKkyZMoU6pcybKly5cwMQYEADs=";

async function builder(page: Page) {
  await page.goto("/app");
  await page.getByTestId("template-corporate-classic").click();
  await page.getByTestId("mode-builder").click();
  await expect(preview(page)).toContainText("Jordan Ellis");
}

test("phone: Add to Gmail stays on screen; mode, redo and settings move into the menu", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app");
  await page.getByTestId("template-corporate-classic").click();
  const install = (await page.getByTestId("open-install").boundingBox())!;
  expect(install.x + install.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.querySelector(".topbar")!.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByTestId("more-menu").click();
  await page.getByTestId("menu-mode").click();
  await expect(page.getByTestId("tab-blocks")).toBeVisible();
  await shot(page, "90-phone-topbar");
});

test("the block toolbar doesn't cover the block above, and the view menu keeps the toolbar on one row", async ({ page }) => {
  await builder(page);
  await preview(page).getByText("jordan@moderngentlemen.co").first().click();
  const bar = (await page.locator(".ov-toolbar").boundingBox())!;
  const name = (await preview(page).getByText("Jordan Ellis").boundingBox())!;
  const overlaps = bar.x < name.x + name.width && name.x < bar.x + bar.width && bar.y < name.y + name.height && name.y < bar.y + bar.height;
  expect(overlaps).toBe(false);

  const tools = page.locator(".preview-tools");
  const rows = await tools.evaluate((el) => new Set([...el.children].map((c) => Math.round(c.getBoundingClientRect().top))).size);
  expect(rows).toBe(1);
  await page.getByTestId("view-menu").click();
  await page.getByRole("switch", { name: "Dark mode preview" }).check();
  await expect(page.getByTestId("view-menu")).toContainText("Dark");
  await expect(page.locator(".mail.dark")).toHaveCount(1);
});

test("double-click opens the useful thing; arrows, Enter and Esc move around the layout", async ({ page }) => {
  await builder(page);
  // Contacts → the phone field in Details.
  await preview(page).getByText("+1 416 555 0182").dblclick();
  await expect(page.getByTestId("field-phone")).toBeFocused();
  await page.getByTestId("tab-blocks").click();

  // Arrow keys step through blocks in reading order.
  await preview(page).getByText("Jordan Ellis").click();
  await expect(page.locator(".insp-title")).toHaveText("Name");
  await page.keyboard.press("ArrowDown");
  await expect(page.locator(".insp-title")).toHaveText("Job title");
  await page.keyboard.press("ArrowUp");
  await expect(page.locator(".insp-title")).toHaveText("Name");
  // Esc selects the columns around it, Enter steps back in, Esc twice deselects.
  await page.keyboard.press("Escape");
  await expect(page.locator(".insp-title")).toHaveText("2 columns");
  await page.keyboard.press("Enter");
  await expect(page.locator(".insp-title")).toHaveText("Logo");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("inline-editor")).toHaveValue("Jordan Ellis");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("inspector")).toContainText("Select any part of your signature");
});

test("the Show in control fits the inspector", async ({ page }) => {
  await builder(page);
  await preview(page).getByText("Jordan Ellis").click();
  const over = await page.getByRole("group", { name: "Show in" }).evaluate((g) => g.scrollWidth - g.clientWidth);
  expect(over).toBeLessThanOrEqual(1);
});

test("an animated GIF is published as a GIF, and rounding it explains that it will stop moving", async ({ page }) => {
  await builder(page);
  await page.getByTestId("palette-image").scrollIntoViewIfNeeded();
  await page.getByTestId("palette-image").click();
  await page
    .getByTestId("inspector")
    .locator('input[type="file"]')
    .setInputFiles({ name: "banner.gif", mimeType: "image/gif", buffer: Buffer.from(GIF, "base64") });
  await expect(preview(page).locator('img[src^="blob:"]')).not.toHaveCount(0);

  // A rounded frame would freeze it — the checks say so.
  await page.getByTestId("inspector").getByRole("group", { name: "Frame shape" }).getByRole("button", { name: "Rounded" }).click();
  await page
    .locator(".preview-tools")
    .getByRole("button", { name: /to check|Looks good|issue/ })
    .click();
  await expect(page.getByText("A frame shape stops a GIF from animating")).toBeVisible();
  await page.keyboard.press("Escape");
  await preview(page).locator('img[src^="blob:"]').last().click();
  await page.getByTestId("inspector").getByRole("group", { name: "Frame shape" }).getByRole("button", { name: "Square" }).click();

  // Publish and copy: the GIF goes out as a .gif.
  await page.getByTestId("open-install").click();
  await page.getByTestId("install-next").click();
  await page.getByRole("button", { name: "Open Settings" }).click();
  await configureTestHost(page);
  await page.getByTestId("settings-dialog").getByRole("button", { name: "Done" }).click();
  await page.getByTestId("install-next").click();
  await page.getByTestId("consent").click();
  await expect(page.getByTestId("copy-full")).toBeEnabled({ timeout: 30_000 });
  await page.getByTestId("copy-full").click();
  const readHtml = () =>
    page.evaluate(async () => {
      const items = await navigator.clipboard.read();
      const item = items.find((i) => i.types.includes("text/html"));
      return item ? await (await item.getType("text/html")).text() : "";
    });
  await expect.poll(readHtml, { timeout: 10_000 }).toMatch(/<img src="http:\/\/localhost:8787\/s\/[0-9a-f]{64}\.gif"/);
});
