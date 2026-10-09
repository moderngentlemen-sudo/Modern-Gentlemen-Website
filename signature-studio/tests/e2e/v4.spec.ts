import { expect, test, type Page } from "@playwright/test";
import { shot } from "./helpers";

const preview = (page: Page) => page.locator('[data-testid="preview"]');
const shadowHtml = (page: Page) => preview(page).evaluate((el) => el.shadowRoot!.innerHTML);

async function openBuilder(page: Page, template = "corporate-classic") {
  await page.goto("/app");
  await page.getByTestId(`template-${template}`).click();
  await page.getByTestId("mode-builder").click();
  await expect(preview(page)).toContainText("Jordan Ellis");
}

test("link selected words, link a whole block, and add hover text", async ({ page }) => {
  await openBuilder(page);
  await page.getByTestId("palette-text").click();
  const box = page.getByTestId("inspector-text");
  await box.fill("Read our latest case study");
  // Select "case study" and press ⌘K.
  await box.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(16, 26));
  await page.keyboard.press("ControlOrMeta+k");
  await page.getByTestId("link-target").fill("example.com/work");
  await page.getByTestId("link-apply").click();
  await expect(box).toHaveValue("Read our latest [case study](example.com/work)");
  expect(await shadowHtml(page)).toMatch(/<a [^>]*href="https:\/\/example\.com\/work"[^>]*>case study<\/a>/);

  await page.getByTestId("section-more").click();
  await page.getByTestId("inspector-hover").fill("See the full story");
  expect(await shadowHtml(page)).toContain('title="See the full story"');

  // Whole-block link to a phone number.
  await page.getByTestId("inspector-link").fill("+1 416 555 0100");
  expect(await shadowHtml(page)).toContain('href="tel:+14165550100"');
  await shot(page, "40-text-links");
});

test("⌘K on the canvas links words while editing in place", async ({ page }) => {
  await openBuilder(page);
  await page.getByTestId("palette-text").click();
  await page.getByTestId("inspector-text").fill("Book a call today");
  await preview(page).getByText("Book a call today").dblclick();
  const ed = page.getByTestId("inline-editor");
  await ed.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(0, 11));
  await page.keyboard.press("ControlOrMeta+k");
  await page.getByTestId("link-target").fill("hello@example.com");
  await page.keyboard.press("Enter");
  await expect(ed).toHaveValue("[Book a call](hello@example.com) today");
  await ed.press("ControlOrMeta+Enter");
  expect(await shadowHtml(page)).toContain('href="mailto:hello@example.com"');
});

test("multi-select: shift-click blocks, restyle them together, put them side by side", async ({ page }) => {
  await openBuilder(page);
  await preview(page).getByText("Jordan Ellis").click();
  await preview(page)
    .getByText("Creative Director")
    .click({ modifiers: ["Shift"] });
  await expect(page.getByTestId("group-title")).toHaveText("2 blocks selected");
  await expect(page.getByTestId("multi-frame")).toHaveCount(2);
  await page.getByTestId("inspector").getByRole("button", { name: "Hidden" }).click();
  // Hidden blocks stay ghosted on the canvas; the layers list shows both as hidden.
  await page.getByTestId("tab-layers").click();
  await expect(page.locator(".layer.is-hidden")).toHaveCount(2);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(page.locator(".layer.is-hidden")).toHaveCount(0);
  await page.getByTestId("group-columns").click();
  await expect(page.getByTestId("inspector")).toContainText("Columns (2)");
  await shot(page, "41-multi-select");
});

test("drop a block on another block's edge to place it beside", async ({ page }) => {
  await openBuilder(page);
  const name = preview(page).getByText("Jordan Ellis");
  await page.getByTestId("palette-button").scrollIntoViewIfNeeded();
  const nb = (await name.boundingBox())!;
  const pal = (await page.getByTestId("palette-button").boundingBox())!;
  await page.mouse.move(pal.x + pal.width / 2, pal.y + pal.height / 2);
  await page.mouse.down();
  await page.mouse.move(pal.x + 30, pal.y + 10, { steps: 3 });
  await page.mouse.move(nb.x + 3, nb.y + nb.height / 2, { steps: 12 });
  await expect(page.getByTestId("drop-beside")).toBeVisible();
  await page.mouse.up();
  const html = await shadowHtml(page);
  // The button now shares a row with the name, to its left.
  const rowStart = html.lastIndexOf("<tr", html.indexOf("Visit our website"));
  expect(html.indexOf("Jordan Ellis", rowStart)).toBeGreaterThan(html.indexOf("Visit our website"));
});

test("version history: save a named version, change things, restore it, undo the restore", async ({ page }) => {
  await openBuilder(page);
  await page.getByTestId("more-menu").click();
  await page.getByTestId("open-history").click();
  await page.getByTestId("version-name").fill("Launch design");
  await page.getByTestId("version-save").click();
  await expect(page.getByTestId("version")).toHaveCount(1);
  await page.getByTestId("history-dialog").getByRole("button", { name: "Close" }).click();

  await preview(page).getByText("Jordan Ellis").click();
  await page.keyboard.press("Delete");
  await expect(preview(page)).not.toContainText("Jordan Ellis");

  await page.getByTestId("more-menu").click();
  await page.getByTestId("open-history").click();
  await page.getByTestId("version").first().click();
  await expect(page.getByTestId("version-peek")).toBeVisible();
  await shot(page, "42-version-history");
  await page.getByTestId("version-restore").first().click();
  await expect(preview(page)).toContainText("Jordan Ellis");

  // The pre-restore state was kept automatically.
  await page.getByTestId("more-menu").click();
  await page.getByTestId("open-history").click();
  await expect(page.getByTestId("version")).toHaveCount(2);
  await expect(page.getByTestId("version").first()).toContainText("automatic");
  await page.keyboard.press("Escape");
  await page.keyboard.press("ControlOrMeta+z");
  await expect(preview(page)).not.toContainText("Jordan Ellis");
});

test("replies can have their own layout, edited separately", async ({ page }) => {
  await openBuilder(page);
  await page.getByTestId("inspector").getByRole("button", { name: "Own layout" }).click();
  await expect(page.getByRole("group", { name: "Signature version" }).getByRole("button", { name: "Reply" })).toHaveAttribute("aria-pressed", "true");
  // Delete the name in the reply layout only.
  await preview(page).getByText("Jordan Ellis").click();
  await page.keyboard.press("Delete");
  await expect(preview(page)).not.toContainText("Jordan Ellis");
  await page.getByRole("group", { name: "Signature version" }).getByRole("button", { name: "New email" }).click();
  await expect(preview(page)).toContainText("Jordan Ellis");
  await shot(page, "43-reply-layout");
});

test("install button appears when the browser offers installation, and the app has a manifest", async ({ page }) => {
  await page.goto("/app");
  await expect(page.getByTestId("install-app")).toHaveCount(0);
  await page.evaluate(() => {
    const e = new Event("beforeinstallprompt") as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
    e.prompt = async () => void ((window as unknown as { prompted: boolean }).prompted = true);
    e.userChoice = Promise.resolve({ outcome: "accepted" });
    window.dispatchEvent(e);
  });
  await page.getByTestId("install-app").click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { prompted?: boolean }).prompted)).toBe(true);
  await expect(page.getByTestId("install-app")).toHaveCount(0);
  const manifest = await page.evaluate(() => fetch("/manifest.webmanifest").then((r) => r.json()));
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true);
});

test("seasonal banner library and ready-made sign-offs", async ({ page }) => {
  await openBuilder(page);
  await page.getByTestId("palette-image").click();
  await page.getByTestId("open-banners").click();
  await page.getByTestId("banner-headline").fill("See you in 2027");
  await shot(page, "44-banner-library");
  await page.getByTestId("banner-new-year").click();
  await expect(page.getByTestId("banner-dialog")).toBeHidden();
  const html = await shadowHtml(page);
  expect(html).toMatch(/<img [^>]*alt="See you in 2027 — Here's to what we'll build together"/);

  await page.getByTestId("palette-signOff").click();
  await page.getByTestId("inspector").getByLabel("Ready-made").selectOption("Warmly,");
  await expect(preview(page)).toContainText("Warmly,");
});

test("right-to-left signatures", async ({ page }) => {
  await openBuilder(page);
  await page.getByTestId("inspector").getByRole("button", { name: "Right to left" }).click();
  const html = await shadowHtml(page);
  expect(html).toContain('dir="rtl"');
  await shot(page, "45-rtl");
});
