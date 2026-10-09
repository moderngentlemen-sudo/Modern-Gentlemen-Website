import { expect, test, type Page } from "@playwright/test";
import { shot } from "./helpers";

const preview = (page: Page) => page.locator('[data-testid="preview"]');

test("live checks catch a typo and jump to the fix; the size meter shows Gmail's budget", async ({ page }) => {
  await page.goto("/app");
  await page.getByTestId("template-corporate-classic").click();
  await expect(page.getByTestId("size-meter")).toContainText("/ 10,000 characters");
  await page.getByTestId("field-email").fill("jordan@gmial.com");
  await expect(page.getByTestId("checks-chip")).toContainText("to check");
  await page.getByTestId("checks-chip").click();
  await expect(page.getByTestId("checks-list")).toContainText("gmail.com");
  await shot(page, "60-checks");
  await page.getByTestId("tab-design").click();
  await page.getByTestId("checks-chip").click();
  await page.getByTestId("checks-list").getByRole("button", { name: "Edit details" }).first().click();
  await expect(page.getByTestId("field-email")).toBeVisible();
  await page.getByTestId("field-email").fill("jordan@gmail.com");
  await expect(page.getByTestId("checks-chip")).toContainText("Looks good");
});

test("quick start: paste an old signature, pick a design", async ({ page }) => {
  await page.goto("/app");
  await page.getByTestId("start-wizard").click();
  await page.getByTestId("wizard-paste").click();
  await page.getByTestId("wizard-paste-text").fill("Priya Nair\nHead of Growth, Northwind\nM: +1 647 555 0119\npriya@northwind.io\nnorthwind.io");
  await page.getByTestId("wizard-paste-apply").click();
  await expect(page.getByTestId("wizard-name")).toHaveValue("Priya Nair");
  await expect(page.getByTestId("wizard-company")).toHaveValue("Northwind");
  await page.getByTestId("wizard-next").click();
  await page.getByTestId("wizard").getByRole("button", { name: "Legal", exact: true }).click();
  await page.getByTestId("wizard-next").click();
  await shot(page, "61-wizard");
  await page.locator('[data-testid^="wizard-pick-"]').first().click();
  await expect(preview(page)).toContainText("Priya Nair");
  await expect(preview(page)).toContainText("northwind.io");
});

test("quick start: import a contact card", async ({ page }) => {
  await page.goto("/app");
  await page.getByTestId("start-wizard").click();
  await page.getByTestId("wizard-vcf").setInputFiles({
    name: "me.vcf",
    mimeType: "text/vcard",
    buffer: Buffer.from("BEGIN:VCARD\nVERSION:3.0\nFN:Sam Rivera\nTITLE:Broker\nORG:Harbour Realty\nEMAIL:sam@harbour.co\nEND:VCARD"),
  });
  await expect(page.getByTestId("wizard-name")).toHaveValue("Sam Rivera");
  await expect(page.getByTestId("wizard-title")).toHaveValue("Broker");
});

test("save a design as my template and reuse it; export a PNG", async ({ page }) => {
  await page.goto("/app");
  await page.getByTestId("template-art-memphis").click();
  await page.getByTestId("more-menu").click();
  const download = page.waitForEvent("download");
  await page.getByTestId("export-png").click();
  expect((await download).suggestedFilename()).toMatch(/\.png$/);

  await page.getByTestId("more-menu").click();
  await page.getByTestId("save-template").click();
  await page.getByTestId("template-name").fill("Candy");
  await page.getByTestId("save-template-confirm").click();
  await page.getByRole("button", { name: "Back to my signatures" }).click();
  await expect(page.getByTestId("my-template")).toContainText("Candy");
  await page.getByTestId("my-template").click();
  await expect(page.getByRole("textbox", { name: "Signature name" })).toHaveValue("Candy");
});

test("edit text on the canvas and drag a column edge with snapping", async ({ page }) => {
  await page.goto("/app");
  await page.getByTestId("template-corporate-classic").click();
  await page.getByTestId("mode-builder").click();
  await preview(page).getByText("Jordan Ellis").dblclick();
  await page.getByTestId("inline-editor").fill("Sam Rivera");
  await page.keyboard.press("Enter");
  await expect(preview(page)).toContainText("Sam Rivera");
  await page.getByTestId("tab-content").click();
  await page.getByTestId("tab-details").click();
  await expect(page.getByTestId("field-name")).toHaveValue("Sam Rivera");

  await preview(page).getByText("Sam Rivera").click();
  const handle = page.getByTestId("col-handle").first();
  const b = (await handle.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + 60, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
  const html = await preview(page).evaluate((el) => el.shadowRoot!.innerHTML);
  expect(html).toMatch(/<td[^>]*width="\d+"[^>]*>\s*<div data-col/);
});
