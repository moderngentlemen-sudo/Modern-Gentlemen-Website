import { expect, test, type Page } from "@playwright/test";
import { shot } from "./helpers";

const preview = (page: Page) => page.locator('[data-testid="preview"]');

async function dragTo(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 12, from.y + 4, { steps: 3 });
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
}

test("drag-and-drop builder: add, move, edit, delete — and the result stays Gmail-ready", async ({ page }) => {
  await page.goto("/app");
  await page.getByTestId("template-corporate-classic").click();
  await page.getByTestId("mode-builder").click();
  await expect(page.getByRole("heading", { name: "Blocks" })).toBeVisible();
  await expect(preview(page)).toContainText("Jordan Ellis");

  // Drag a Button from the palette to the bottom of the signature.
  await page.getByTestId("palette-button").scrollIntoViewIfNeeded();
  const stage = (await page.getByTestId("stage").boundingBox())!;
  const pal = (await page.getByTestId("palette-button").boundingBox())!;
  await dragTo(page, { x: pal.x + pal.width / 2, y: pal.y + pal.height / 2 }, { x: stage.x + 40, y: stage.y + stage.height - 4 });
  await expect(preview(page)).toContainText("Visit our website");
  await expect(page.getByTestId("inspector")).toContainText("Button");

  // Tap-to-add: a Text block goes below the selection; edit it in the inspector.
  await page.getByTestId("palette-text").click();
  await page.getByTestId("inspector-text").fill("Available Mon–Fri, 9–5");
  await expect(preview(page)).toContainText("Available Mon–Fri, 9–5");
  await shot(page, "10-builder");

  // Move the text block to the very top by dragging it.
  const text = preview(page).getByText("Available Mon–Fri, 9–5");
  const tb = (await text.boundingBox())!;
  const top = (await preview(page).boundingBox())!;
  await dragTo(page, { x: tb.x + 10, y: tb.y + tb.height / 2 }, { x: top.x + 20, y: top.y + 2 });
  const html = await preview(page).evaluate((el) => el.shadowRoot!.innerHTML);
  expect(html.indexOf("Available Mon–Fri")).toBeLessThan(html.indexOf("Jordan Ellis"));

  // Delete with the keyboard, then undo.
  await page.keyboard.press("Delete");
  await expect(preview(page)).not.toContainText("Available Mon–Fri");
  await page.keyboard.press("ControlOrMeta+z");
  await expect(preview(page)).toContainText("Available Mon–Fri");

  // Layout survives a reload (autosave + route).
  await page.waitForTimeout(800);
  await page.reload();
  await expect(preview(page)).toContainText("Available Mon–Fri");
  await expect(page.getByTestId("mode-builder")).toHaveAttribute("aria-pressed", "true");
});

test("brand kit styles new signatures", async ({ page }) => {
  await page.goto("/app");
  await page.getByTestId("open-brand").click();
  const dialog = page.getByTestId("brand-dialog");
  await dialog.getByLabel("Company").fill("Northwind Studio");
  await dialog.getByRole("button", { name: /^Accent:/ }).click();
  await dialog.getByRole("dialog", { name: "Accent picker" }).getByRole("button", { name: "#dc2626" }).first().click();
  await page.getByTestId("save-brand").click();
  await page.getByTestId("start-blank").click();
  await expect(page.getByTestId("mode-builder")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("palette-company").click();
  await expect(page.locator('[data-testid="preview"]')).toContainText("Northwind Studio");
  const html = await page.locator('[data-testid="preview"]').evaluate((el) => el.shadowRoot!.innerHTML);
  expect(html.toLowerCase()).toContain("#dc2626");
});
