import { expect, test } from "@playwright/test";
import { canvaPng, configureTestHost, shot } from "./helpers";

test("a Canva signature design becomes a clickable, pixel-exact Gmail signature", async ({ page }) => {
  await page.goto("/app");
  await shot(page, "01-home");
  await page.getByTestId("canva-signature").click();
  await expect(page.getByRole("heading", { name: "Canva design" })).toBeVisible();

  // 1300×500 export: the design itself is 1200×400 inside 50px of empty page.
  const png = await canvaPng(page, { width: 1300, height: 500, margin: 50 });
  await page.getByTestId("upload-card-front").setInputFiles({ name: "canva-signature.png", mimeType: "image/png", buffer: png });
  await expect(page.getByText(/Trimmed empty edges \(1300×500 → \d+×\d+\)/)).toBeVisible();
  await expect(page.getByText("Sharp on every screen")).toBeVisible();

  await page.getByTestId("canva-email").fill("jordan@example.com");
  await page.getByTestId("canva-website").fill("example.com");

  // Draw a clickable area over the email address.
  const stage = page.getByTestId("card-stage");
  const box = (await stage.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.52, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.95, box.y + box.height * 0.68, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByTestId("hotspot")).toHaveCount(1);
  await page.getByLabel("When clicked").selectOption("email");
  await expect(page.locator('[data-testid="preview"] a[href="mailto:jordan@example.com"]')).toHaveCount(1);
  await shot(page, "02-canva-editor");

  // Install: configure the (test) image host, consent, publish, copy.
  await page.getByTestId("open-install").click();
  await page.getByTestId("install-next").click();
  await page.getByRole("button", { name: "Open Settings" }).click();
  await configureTestHost(page);
  await page.getByTestId("settings-dialog").getByRole("button", { name: "Done" }).click();
  await page.getByTestId("install-next").click();
  await page.getByTestId("consent").click();
  await expect(page.getByTestId("copy-full")).toBeEnabled({ timeout: 30_000 });
  await shot(page, "03-install-copy");
  await page.getByTestId("copy-full").click();

  // Copying is asynchronous: wait until the rich HTML has actually landed on the clipboard.
  const readHtml = () =>
    page.evaluate(async () => {
      const items = await navigator.clipboard.read();
      const item = items.find((i) => i.types.includes("text/html"));
      return item ? await (await item.getType("text/html")).text() : "";
    });
  await expect.poll(readHtml, { timeout: 10_000 }).toContain("<table");
  const html = await readHtml();
  expect(html).toContain('href="mailto:jordan@example.com"');
  expect(html).toMatch(/<img src="http:\/\/localhost:8787\/s\/[0-9a-f]{64}\.png"/);
  expect(html).not.toMatch(/data:|blob:/);
  expect(html).toContain('alt="Email signature"'); // the design is the image; no generated text signature
  expect(html.length).toBeLessThan(10_000);
});
