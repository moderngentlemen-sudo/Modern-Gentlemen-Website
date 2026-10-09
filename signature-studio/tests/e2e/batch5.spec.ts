import { readdirSync, readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { canvaPng, configureTestHost, shot } from "./helpers";

const preview = (page: Page) => page.locator('[data-testid="preview"]');
const shadowHtml = (page: Page) => preview(page).evaluate((el) => el.shadowRoot!.innerHTML);
const useFakeCloud = (page: Page) => page.addInitScript(() => localStorage.setItem("signet.fakeCloud", "1"));
const cloudDb = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("signet.fakeCloud.db") ?? "{}"));

async function signIn(page: Page) {
  await page.getByTestId("sign-in").click();
  await page.getByTestId("sign-in-email").fill("ada@example.com");
  await page.getByTestId("sign-in-send").click();
  await expect(page.getByTestId("account-menu")).toContainText("ada@example.com");
}

async function builder(page: Page) {
  await page.getByTestId("template-corporate-classic").click();
  await page.getByTestId("mode-builder").click();
  await expect(preview(page)).toContainText("Jordan Ellis");
}

/** Any small TrueType file that ships with the test tooling. */
function fontFile(): Buffer {
  const dir = "node_modules/playwright-core/lib/vite/recorder/assets";
  const name = readdirSync(dir).find((f) => f.endsWith(".ttf"))!;
  return readFileSync(`${dir}/${name}`);
}

test("remove a logo's flat background in the browser", async ({ page }) => {
  await page.goto("/app");
  await page.getByTestId("template-corporate-classic").click();
  await page.getByTestId("tab-images").click();
  const png = await canvaPng(page, { width: 600, height: 300, margin: 60 });
  await page.getByTestId("upload-logo").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: png });
  await page.getByTestId("adjust-logo").click();
  await page.getByTestId("crop-dialog").getByRole("button", { name: "Adjust" }).click();
  await page.getByTestId("bg-flat").click();
  await expect(page.getByText("Background removed")).toBeVisible();
  // The result is transparent in the corners.
  const corner = await page
    .getByTestId("crop-stage")
    .locator("img")
    .evaluate(async (img: HTMLImageElement) => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const g = c.getContext("2d")!;
      g.drawImage(img, 0, 0);
      return g.getImageData(2, 2, 1, 1).data[3];
    });
  expect(corner).toBe(0);
});

test("cut a person out of a photo on this device", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/app");
  await page.getByTestId("template-corporate-classic").click();
  await page.getByTestId("tab-images").click();
  const png = await canvaPng(page, { width: 400, height: 400, margin: 0 });
  await page.getByTestId("upload-photo").setInputFiles({ name: "me.png", mimeType: "image/png", buffer: png });
  await page.getByTestId("adjust-photo").click();
  await page.getByTestId("crop-dialog").getByRole("button", { name: "Adjust" }).click();
  await page.getByTestId("bg-person").click();
  await expect(page.getByText("Background removed")).toBeVisible({ timeout: 90_000 });
});

test("text styles: save one, use it on another block, change it everywhere", async ({ page }) => {
  await page.goto("/app");
  await builder(page);
  await page.getByTestId("palette-text").click();
  await page.getByTestId("inspector-text").fill("First line");
  await page.getByTestId("tf-weight").selectOption("800");
  await page.getByTestId("save-style").click();
  await page.getByTestId("style-name").fill("Heading");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("text-style")).toHaveValue(/ts/);

  await page.getByTestId("palette-text").click();
  await page.getByTestId("inspector-text").fill("Second line");
  await page.getByTestId("text-style").selectOption({ label: "Heading" });
  await expect.poll(async () => ((await shadowHtml(page)).match(/font-weight:800/g) ?? []).length).toBeGreaterThanOrEqual(2);

  // Change the second block, then push the change into the style: both follow.
  await page.getByTestId("tf-weight").selectOption("300");
  await page.getByTestId("update-style").click();
  await expect.poll(async () => ((await shadowHtml(page)).match(/font-weight:300/g) ?? []).length).toBeGreaterThanOrEqual(2);
  await shot(page, "100-text-styles");
});

test("upload a brand font: it previews in the editor and goes out as an image", async ({ page }) => {
  await page.goto("/app");
  await builder(page);
  await preview(page).getByText("Jordan Ellis").click();
  await page.getByTestId("font-upload").setInputFiles({ name: "Brand-Display.ttf", mimeType: "font/ttf", buffer: fontFile() });
  await expect(page.getByText("Brand Display added")).toBeVisible();
  await expect(page.getByTestId("as-image")).toBeChecked();
  expect(await shadowHtml(page)).toContain("'Brand Display'");
  await page.getByTestId("font-picker").click();
  await expect(page.locator('.fp-opt[data-font="custom:Brand Display"]')).toBeVisible();
});

test("live banner: scheduled pictures are published and the email points at the live link", async ({ page }) => {
  await useFakeCloud(page);
  await page.goto("/app");
  await signIn(page);
  await builder(page);
  await page.getByTestId("palette-image").scrollIntoViewIfNeeded();
  await page.getByTestId("palette-image").click();
  const insp = page.getByTestId("inspector");
  await insp
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: "main.png", mimeType: "image/png", buffer: await canvaPng(page, { width: 600, height: 150, margin: 0 }) });
  await insp.getByTestId("live-toggle").click();
  await insp.getByTestId("live-add").click();
  await insp
    .locator(".live-item input[type=file]")
    .setInputFiles({ name: "sale.png", mimeType: "image/png", buffer: await canvaPng(page, { width: 600, height: 150, margin: 10 }) });
  await insp.getByLabel("Banner 1 link").fill("https://example.com/sale");
  await insp.getByLabel("Banner 1 starts").fill("2026-11-24");
  await insp.getByLabel("Banner 1 ends").fill("2026-11-30");
  await insp.getByTestId("live-track").click();
  await shot(page, "101-live-banner");

  await page.getByTestId("open-install").click();
  await page.getByTestId("install-next").click();
  const settings = page.getByRole("button", { name: "Open Settings" });
  if (await settings.isVisible()) {
    await settings.click();
    await configureTestHost(page);
    await page.getByTestId("settings-dialog").getByRole("button", { name: "Done" }).click();
    await page.getByTestId("install-next").click();
  }
  const consent = page.getByTestId("consent");
  if (await consent.isVisible()) await consent.click();
  await expect(page.getByTestId("copy-full")).toBeEnabled({ timeout: 30_000 });
  const db = await cloudDb(page);
  const banners = Object.values(db.banners ?? {}) as { slug: string; items: { link?: string; from?: string }[]; track: boolean }[];
  expect(banners).toHaveLength(1);
  expect(banners[0].items[0]).toMatchObject({ link: "https://example.com/sale", from: "2026-11-24" });
  expect(banners[0].track).toBe(true);
  await page.getByTestId("copy-full").click();
  const readHtml = () =>
    page.evaluate(async () => {
      const items = await navigator.clipboard.read();
      const item = items.find((i) => i.types.includes("text/html"));
      return item ? await (await item.getType("text/html")).text() : "";
    });
  await expect.poll(readHtml, { timeout: 10_000 }).toContain(`/__live/banner/${banners[0].slug}/img`);
  const html = await readHtml();
  expect(html).toContain(`/__live/banner/${banners[0].slug}/go`);
});

test("AI suggestions: three directions previewed with your content, applied in one click", async ({ page }) => {
  await useFakeCloud(page);
  await page.goto("/app");
  await signIn(page);
  await page.getByTestId("template-corporate-classic").click();
  await page.getByTestId("tab-templates").click();
  await page.getByTestId("ai-ask").click();
  const tiles = page.getByTestId("ai-suggest").locator(".sig-tile");
  await expect(tiles).toHaveCount(3);
  await tiles.first().click();
  await expect.poll(async () => (await shadowHtml(page)).toLowerCase()).toContain("#0f766e");
  await shot(page, "102-ai-suggest");
});
