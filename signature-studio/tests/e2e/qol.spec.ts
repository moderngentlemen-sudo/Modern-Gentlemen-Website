import { expect, test, type Page } from "@playwright/test";
import { canvaPng, shot } from "./helpers";

const preview = (page: Page) => page.locator('[data-testid="preview"]');
const html = (page: Page) => preview(page).evaluate((el) => el.shadowRoot!.innerHTML);

async function builderFrom(page: Page, template = "corporate-classic") {
  await page.goto("/app");
  await page.getByTestId(`template-${template}`).click();
  await page.getByTestId("mode-builder").click();
  await expect(preview(page)).toContainText("Jordan Ellis");
}

test("resize handle scales the selected block", async ({ page }) => {
  await builderFrom(page);
  await preview(page).getByText("Jordan Ellis").click();
  const before = await html(page);
  const size = (h: string) => Number(/font-size:(\d+)px;[^"]*">Jordan Ellis/.exec(h)![1]);
  const handle = page.getByTestId("resize-handle");
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 80, box.y + 4, { steps: 8 });
  await page.mouse.up();
  expect(size(await html(page))).toBeGreaterThan(size(before));
  await page.keyboard.press("ControlOrMeta+z");
  expect(size(await html(page))).toBe(size(before));
});

test("handles on every side and corner scale the block, growing outward and shrinking inward", async ({ page }) => {
  await builderFrom(page);
  await preview(page).getByText("Jordan Ellis").click();
  // A one-line name is short: corners plus top and bottom (side handles would cover the corners).
  for (const dir of ["n", "ne", "se", "s", "sw", "nw"]) await expect(page.getByTestId(dir === "se" ? "resize-handle" : `resize-handle-${dir}`)).toBeVisible();
  await shot(page, "53-handles");
  const size = async () => Number(/font-size:(\d+)px;[^"]*">Jordan Ellis/.exec(await html(page))![1]);
  const drag = async (dir: string, dx: number, dy: number) => {
    const b = (await page.getByTestId(`resize-handle-${dir}`).boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + dx, b.y + b.height / 2 + dy, { steps: 8 });
    await page.mouse.up();
  };
  const start = await size();
  await drag("sw", -60, 0); // bottom-left corner, outward
  const wider = await size();
  expect(wider).toBeGreaterThan(start);
  await drag("n", 0, 6); // top edge, inward
  const smaller = await size();
  expect(smaller).toBeLessThan(wider);
  await drag("nw", -40, -40); // top-left corner, outward
  expect(await size()).toBeGreaterThan(smaller);

  // A taller block (the photo) gets all eight, and its left edge works too.
  await preview(page).locator("img").nth(1).click();
  for (const dir of ["n", "ne", "e", "se", "s", "sw", "w", "nw"])
    await expect(page.getByTestId(dir === "se" ? "resize-handle" : `resize-handle-${dir}`)).toBeVisible();
  const photo = async () => (await preview(page).locator("img").nth(1).boundingBox())!.width;
  const p0 = await photo();
  await drag("w", -30, 0);
  expect(await photo()).toBeGreaterThan(p0);
});

test("new blocks, palette search, hide from layers, copy/paste", async ({ page }) => {
  await builderFrom(page);
  await page.getByTestId("palette-search").fill("qr");
  await expect(page.getByTestId("palette-qr")).toBeVisible();
  await expect(page.getByTestId("palette-name")).toHaveCount(0);
  await page.getByTestId("palette-qr").click();
  await expect.poll(async () => (await html(page)).includes("Scan to visit")).toBe(true);
  await page.getByTestId("palette-search").fill("");
  await page.getByTestId("palette-hiring").click();
  await expect(preview(page)).toContainText("We're hiring");

  // Copy / paste the tag.
  await page.locator("body").click({ position: { x: 5, y: 500 } });
  await preview(page).getByText("We're hiring").click();
  await page.keyboard.press("ControlOrMeta+c");
  await page.keyboard.press("ControlOrMeta+v");
  await expect.poll(async () => ((await html(page)).match(/We're hiring/g) ?? []).length).toBe(2);

  // Hide from the layers panel: faded while editing, gone from the email.
  await page.getByTestId("tab-layers").click();
  const first = page.getByTestId("layer").filter({ hasText: "We're hiring" }).first();
  await first.hover();
  await first.getByRole("button", { name: /^Hide/ }).click();
  await expect.poll(async () => (await html(page)).includes('style="opacity:.3;"')).toBe(true);
  await shot(page, "50-qol-builder");
});

test("whole-signature size and canvas zoom", async ({ page }) => {
  await builderFrom(page);
  const size = (h: string) => Number(/font-size:(\d+)px;[^"]*">Jordan Ellis/.exec(h)![1]);
  const before = size(await html(page));
  await page.getByTestId("tab-design").click();
  await page.locator(".panel").getByTestId("scale").fill("1.3");
  await expect.poll(async () => size(await html(page))).toBeGreaterThan(before);
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(page.getByTestId("zoom-level")).toHaveText("110%");
});

test("zoom & crop a photo by dragging", async ({ page }) => {
  await page.goto("/app");
  await page.getByTestId("template-corporate-classic").click();
  await page.getByTestId("tab-images").click();
  const png = await canvaPng(page, { width: 600, height: 600, margin: 0 });
  await page.getByTestId("upload-photo").setInputFiles({ name: "me.png", mimeType: "image/png", buffer: png });
  await page.getByTestId("adjust-photo").click();
  const stage = page.getByTestId("crop-stage");
  await page.getByTestId("crop-dialog").getByLabel("Zoom", { exact: true }).fill("2");
  const leftOf = async () => (await stage.locator("img").getAttribute("style"))!;
  const before = await leftOf();
  const b = (await stage.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 60, b.y + b.height / 2 + 30, { steps: 6 });
  await page.mouse.up();
  expect(await leftOf()).not.toBe(before);
  await shot(page, "51-crop");
});

test("contact details persist across signatures", async ({ page }) => {
  await page.goto("/app");
  await page.getByTestId("template-corporate-classic").click();
  await page.getByTestId("field-name").fill("Avery Stone");
  await page.getByTestId("field-phone").fill("+1 555 0100");
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: "Back to my signatures" }).click();

  // A new signature starts with the saved details…
  await page.getByTestId("template-art-deco").click();
  await expect(preview(page)).toContainText("Avery Stone");
  await expect(page.getByTestId("profile-link")).toContainText("1 other linked signature");
  // …and editing them here updates the first one too.
  await page.getByTestId("field-phone").fill("+1 555 0199");
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: "Back to my signatures" }).click();
  await page.getByTestId("my-signature").filter({ hasText: "Corporate Classic" }).click();
  await expect(preview(page)).toContainText("+1 555 0199");

  // Unlinked signatures keep their own copy.
  await page.getByTestId("use-profile").click();
  await page.getByTestId("field-phone").fill("+1 555 0000");
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: "Back to my signatures" }).click();
  await page.getByTestId("my-signature").filter({ hasText: "Deco" }).click();
  await expect(preview(page)).toContainText("+1 555 0199");
});

test("tapping blocks in a row stacks them instead of nesting inside a panel", async ({ page }) => {
  await builderFrom(page);
  await page.getByTestId("palette-promo").click();
  await page.getByTestId("palette-event").click();
  await page.getByTestId("tab-layers").click();
  // Both panels sit at the top level (depth 0 → 10px indent).
  const panels = page.getByTestId("layer").filter({ hasText: "Panel" });
  await expect(panels).toHaveCount(2);
  for (const p of await panels.all()) await expect(p).toHaveAttribute("style", /padding-left: 10px/);
});
