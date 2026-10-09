import { expect, test, type Page } from "@playwright/test";
import { shot } from "./helpers";

const preview = (page: Page) => page.locator('[data-testid="preview"]');
const html = (page: Page) => preview(page).evaluate((el) => el.shadowRoot!.innerHTML);

async function builder(page: Page) {
  await page.goto("/app");
  await page.getByTestId("template-corporate-classic").click();
  await page.getByTestId("mode-builder").click();
  await expect(preview(page)).toContainText("Jordan Ellis");
}

test("formatting toolbar: weight, size, underline, case, spacing and colour roles", async ({ page }) => {
  await builder(page);
  await preview(page).getByText("Creative Director").click();
  const bar = page.getByTestId("text-format");
  await expect(bar).toBeVisible();
  await page.getByTestId("tf-weight").selectOption("600");
  await page.getByTestId("tf-underline").click();
  await bar.getByRole("button", { name: "Small capitals" }).click();
  await bar.getByRole("button", { name: "Larger text" }).click();
  await bar.getByRole("group", { name: "Text colour role" }).getByRole("button", { name: "Accent" }).click();
  await bar.locator("summary").click();
  await bar.getByRole("textbox", { name: "Letter spacing value" }).fill("0.1");
  const h = await html(page);
  expect(h).toMatch(/font-weight:600;[^"]*text-decoration:underline;font-variant:small-caps;[^"]*letter-spacing:0\.1em;[^"]*">Creative Director/);
  await shot(page, "95-text-format");
  // Undo walks it back one step at a time (from the canvas, not a text field).
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(() => html(page)).not.toContain("letter-spacing:0.1em");
});

test("visual font picker shows each font in its own face", async ({ page }) => {
  await builder(page);
  await preview(page).getByText("Jordan Ellis").click();
  await page.getByTestId("font-picker").click();
  const option = page.locator('.fp-opt[data-font="playfair"]');
  await expect(option).toBeVisible();
  expect(await option.locator(".fp-sample").evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/Playfair/);
  await option.click();
  await expect(page.getByTestId("font-picker")).toContainText("Playfair");
  expect(await html(page)).toMatch(/Playfair Display[^"]*">Jordan Ellis/);
});

test("format selected words in the inspector and on the canvas; quotes tidy themselves", async ({ page }) => {
  await builder(page);
  await page.getByTestId("palette-text").click();
  const box = page.getByTestId("inspector-text");
  await box.fill("Book a call today");
  await box.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(5, 11));
  await page.getByTestId("rich-bold").click();
  await expect(box).toHaveValue("Book **a call** today");
  expect(await html(page)).toContain('<strong style="font-weight:700;">a call</strong>');

  // Smart typography as you type, and Backspace undoes it.
  await box.press("End");
  await box.pressSequentially(' "now"');
  await expect(box).toHaveValue("Book **a call** today “now”");
  await box.pressSequentially("--");
  await expect(box).toHaveValue("Book **a call** today “now”—");
  await box.press("Backspace");
  await expect(box).toHaveValue("Book **a call** today “now”--");

  // On the canvas: highlight with the floating toolbar.
  await box.fill("Spring sale ends Friday");
  await preview(page).getByText("Spring sale ends Friday").dblclick();
  const ed = page.getByTestId("inline-editor");
  await ed.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(17, 23));
  await page.locator(".ov-rich").getByTestId("rich-highlight").click();
  await expect(ed).toHaveValue("Spring sale ends ==Friday==");
  await ed.press("ControlOrMeta+Enter");
  expect(await html(page)).toMatch(/background-color:#[0-9a-f]{6};padding:0 2px;">Friday<\/span>/);
});

test("colour picker puts the signature's own colours first", async ({ page }) => {
  await builder(page);
  await preview(page).getByText("Jordan Ellis").click();
  await page.getByTestId("text-format").getByRole("group", { name: "Text colour role" }).getByRole("button", { name: "Custom" }).click();
  await page.getByRole("button", { name: /^Custom colour:/ }).click();
  const pop = page.getByRole("dialog", { name: "Custom colour picker" });
  await expect(pop.locator(".cp-title").first()).toHaveText("This signature");
  await pop.getByRole("textbox", { name: "Custom colour hex" }).fill("#c8102e");
  expect(await html(page)).toMatch(/color:#c8102e;[^"]*">Jordan Ellis/i);
});
