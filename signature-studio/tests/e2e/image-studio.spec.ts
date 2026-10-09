import { expect, test, type Page } from "@playwright/test";
import { canvaPng, configureTestHost, shot } from "./helpers";

const preview = (page: Page) => page.locator('[data-testid="preview"]');

async function withPhoto(page: Page) {
  await page.goto("/app");
  await page.getByTestId("template-corporate-classic").click();
  await page.getByTestId("tab-images").click();
  const png = await canvaPng(page, { width: 600, height: 600, margin: 40 });
  await page.getByTestId("upload-photo").setInputFiles({ name: "me.png", mimeType: "image/png", buffer: png });
  await expect(page.getByTestId("adjust-photo")).toBeVisible();
}

/** Drop or paste a generated PNG file onto an element. */
async function sendFile(page: Page, how: "drop" | "paste", selector: string) {
  await page.evaluate(
    async ({ how, selector }) => {
      const c = document.createElement("canvas");
      c.width = 400;
      c.height = 200;
      const g = c.getContext("2d")!;
      g.fillStyle = how === "drop" ? "#0f766e" : "#c8102e";
      g.fillRect(0, 0, 400, 200);
      const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), "image/png"));
      const dt = new DataTransfer();
      dt.items.add(new File([blob], `${how}.png`, { type: "image/png" }));
      const el = document.querySelector(selector)!;
      if (how === "drop") {
        el.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }));
        el.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
      } else el.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: dt }));
    },
    { how, selector },
  );
}

test("frame a photo: squircle, border, ring and shadow — the preview draws it as the email will", async ({ page }) => {
  await withPhoto(page);
  const studio = page.getByTestId("image-studio").first();
  await studio.getByRole("group", { name: "Frame shape" }).getByRole("button", { name: "Squircle" }).click();
  await studio.getByLabel("Border value").fill("3");
  await expect(studio.getByRole("button", { name: /^Border colour:/ })).toBeVisible();
  await studio.getByLabel("Ring gap value").fill("2");
  await page.getByTestId("image-shadow").click();
  await expect(preview(page).locator("svg clipPath")).not.toHaveCount(0);
  await expect(preview(page).locator("feDropShadow")).toHaveCount(1);
  await shot(page, "96-image-frame");

  // Published and copied: one PNG at 2×, the shadow margin included.
  await page.getByTestId("open-install").click();
  await page.getByTestId("install-next").click();
  await page.getByRole("button", { name: "Open Settings" }).click();
  await configureTestHost(page);
  await page.getByTestId("settings-dialog").getByRole("button", { name: "Done" }).click();
  await page.getByTestId("install-next").click();
  await page.getByTestId("consent").click();
  await expect(page.getByTestId("copy-full")).toBeEnabled({ timeout: 30_000 });
  await page.getByTestId("copy-full").click();
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const items = await navigator.clipboard.read();
          const item = items.find((i) => i.types.includes("text/html"));
          return item ? await (await item.getType("text/html")).text() : "";
        }),
      { timeout: 10_000 },
    )
    .toContain('alt="Photo"');
  const size = await page.evaluate(async () => {
    const items = await navigator.clipboard.read();
    const text = await (await items.find((i) => i.types.includes("text/html"))!.getType("text/html")).text();
    const m = /<img src="([^"]+)" width="(\d+)" height="(\d+)" alt="Photo"/.exec(text)!;
    const bmp = await createImageBitmap(await (await fetch(m[1])).blob());
    return { attr: Number(m[2]), w: bmp.width, h: bmp.height };
  });
  expect(size.attr).toBeGreaterThan(84);
  expect(size.w).toBe(size.attr * 2);
  expect(size.h).toBe(size.w);
});

test("image editor: rotate, flip, nudge, auto-frame and colour presets", async ({ page }) => {
  await withPhoto(page);
  await page.getByTestId("adjust-photo").click();
  const dialog = page.getByTestId("crop-dialog");
  const stage = page.getByTestId("crop-stage");
  const img = stage.locator("img");

  const before = await img.getAttribute("src");
  await page.getByTestId("rotate-right").click();
  await expect(img).not.toHaveAttribute("src", before!);
  await expect(dialog.getByRole("button", { name: "Undo rotate & flip" })).toBeVisible();
  await page.getByTestId("flip-h").click();
  await dialog.getByRole("button", { name: "Undo rotate & flip" }).click();
  await expect(img).toHaveAttribute("src", before!);

  // Keyboard: zoom with +, move with the arrow keys.
  await dialog.getByLabel("Zoom", { exact: true }).fill("2");
  const style = await img.getAttribute("style");
  await stage.focus();
  await page.keyboard.press("Shift+ArrowLeft");
  await expect(img).not.toHaveAttribute("style", style!);
  await page.getByTestId("auto-frame").click();

  await dialog.getByRole("button", { name: "Adjust" }).click();
  await page.getByTestId("preset-mono").click();
  await expect(page.getByTestId("preset-mono")).toHaveAttribute("aria-pressed", "true");
  await expect(preview(page).locator("feColorMatrix")).toHaveCount(1);
  await dialog.getByLabel("Brightness value").fill("20");
  await shot(page, "97-image-editor");
  await page.getByTestId("preset-duotone").click();
  await expect(dialog.getByRole("button", { name: /^Shadows:/ })).toBeVisible();
  await dialog.getByRole("button", { name: "Reset colours" }).click();
  await expect(preview(page).locator("feColorMatrix")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Done" }).click();
});

test("drop or paste an image onto the canvas, and reuse uploads from the library", async ({ page }) => {
  await withPhoto(page);
  await page.getByTestId("mode-builder").click();
  const images = () => preview(page).locator('img[src^="blob:"], svg image');
  const count = await images().count();

  await sendFile(page, "drop", '[data-testid="stage"]');
  await expect(images()).toHaveCount(count + 1);
  await expect(page.getByTestId("inspector").getByTestId("image-studio")).toBeVisible();

  // Pasting with an image block selected replaces its picture.
  const src = await page.getByTestId("inspector").locator(".image-drop img").getAttribute("src");
  await sendFile(page, "paste", "body");
  await expect(page.getByTestId("inspector").locator(".image-drop img")).not.toHaveAttribute("src", src!);
  await expect(images()).toHaveCount(count + 1);

  // The library offers everything uploaded on this device.
  await page.getByTestId("palette-image").scrollIntoViewIfNeeded();
  await page.getByTestId("palette-image").click();
  await page.getByTestId("inspector").getByTestId("open-library").click();
  const lib = page.getByRole("dialog", { name: "Image library" });
  await expect(lib.getByRole("button", { name: /^Use / })).toHaveCount(3);
  await lib.getByRole("button", { name: "Use me.png" }).click();
  await expect(images()).toHaveCount(count + 2);
});

test("logo tools: trim empty edges and make a white version", async ({ page }) => {
  await page.goto("/app");
  await page.getByTestId("template-corporate-classic").click();
  await page.getByTestId("tab-images").click();
  const png = await canvaPng(page, { width: 600, height: 300, margin: 60 });
  await page.getByTestId("upload-logo").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: png });
  await page.getByTestId("adjust-logo").click();
  await page.getByTestId("crop-dialog").getByRole("button", { name: "Adjust" }).click();
  await page.getByTestId("trim-logo").click();
  await expect(page.getByText("Empty edges trimmed")).toBeVisible();
  await page.getByTestId("logo-white").click();
  await expect(page.getByTestId("preset-recolor")).toHaveAttribute("aria-pressed", "true");
});
