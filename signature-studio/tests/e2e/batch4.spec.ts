import { expect, test, type Page } from "@playwright/test";
import { shot } from "./helpers";

const preview = (page: Page) => page.locator('[data-testid="preview"]');
const shadowHtml = (page: Page) => preview(page).evaluate((el) => el.shadowRoot!.innerHTML);

async function builder(page: Page) {
  await page.goto("/app");
  await page.getByTestId("template-corporate-classic").click();
  await page.getByTestId("mode-builder").click();
  await expect(preview(page)).toContainText("Jordan Ellis");
}

test("five places in the builder rail; Content and Style hold their panels as sub-tabs", async ({ page }) => {
  await builder(page);
  const rail = page.getByRole("tablist", { name: "Editor sections" });
  await expect(rail.getByRole("tab")).toHaveText(["Add", "Layers", "Content", "Style", "Publish"]);
  await page.getByTestId("tab-content").click();
  await page.getByTestId("tab-images").click();
  await page.getByTestId("tab-style").click();
  await expect(page.getByTestId("tab-design")).toHaveAttribute("aria-selected", "true");
  // Coming back to Content returns to the panel you left.
  await page.getByTestId("tab-content").click();
  await expect(page.getByTestId("tab-images")).toHaveAttribute("aria-selected", "true");
  await page.getByTestId("tab-publish").click();
  await expect(page.getByTestId("publish-install")).toBeVisible();
});

test("Quick mode is a guided path with numbered steps and Next", async ({ page }) => {
  await page.goto("/app");
  await page.getByTestId("template-corporate-classic").click();
  await page.getByTestId("tab-templates").click();
  await expect(page.getByTestId("step-nav")).toContainText("Step 1 of 6");
  await page.getByTestId("step-next").click();
  await expect(page.getByTestId("tab-details")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("tab-details").locator(".step-dot.done")).toHaveCount(1);
  for (let i = 0; i < 4; i++) await page.getByTestId("step-next").click();
  await expect(page.getByTestId("step-install")).toBeVisible();
});

test("a calmer inspector: folded sections with summaries, a breadcrumb, and details edited in place", async ({ page }) => {
  await builder(page);
  await preview(page).getByText("Creative Director").click();
  const insp = page.getByTestId("inspector");
  // Details are right there.
  await insp.getByTestId("detail-title").fill("Head of Design");
  await expect(preview(page)).toContainText("Head of Design");
  // Fold Style: it shows a one-line summary instead.
  await page.getByTestId("section-style").click();
  await expect(page.getByTestId("section-style")).toContainText("px");
  await expect(insp.getByTestId("text-format")).toHaveCount(0);
  await expect(page.getByTestId("section-more")).toContainText("New emails & replies");
  // The breadcrumb climbs to the column the block sits in.
  await expect(page.getByTestId("breadcrumb")).toContainText("Column 2");
  await page.getByTestId("breadcrumb").getByRole("button", { name: "Column 2" }).click();
  await expect(insp).toContainText("Align contents");
  await shot(page, "98-inspector-sections");
});

test("precise scaling: exact size, presets, [ and ], and image edges that change the shape", async ({ page }) => {
  await builder(page);
  await preview(page).getByText("Jordan Ellis").click();
  const chip = page.getByTestId("size-chip");
  await expect(chip).toContainText("px name");
  await page.keyboard.press("BracketRight");
  await page.keyboard.press("Shift+BracketRight");
  await chip.click();
  await expect(page.getByTestId("size-input")).toHaveValue("1.55");
  await page.getByTestId("size-input").fill("2");
  await page.keyboard.press("Enter");
  await expect(chip).toContainText(/^\d+px name$/);

  // An image: side edges unlock its proportions.
  await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 600;
    c.height = 200;
    c.getContext("2d")!.fillRect(0, 0, 600, 200);
    const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), "image/png"));
    const dt = new DataTransfer();
    dt.items.add(new File([blob], "wide.png", { type: "image/png" }));
    document.querySelector('[data-testid="stage"]')!.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
  });
  await expect(chip).toHaveText(/^\d+ × \d+$/);
  const [w0, h0] = (await chip.innerText()).split(" × ").map(Number);
  const e = (await page.getByTestId("resize-handle-e").boundingBox())!;
  await page.mouse.move(e.x + e.width / 2, e.y + e.height / 2);
  await page.mouse.down();
  await page.mouse.move(e.x + e.width / 2 - 60, e.y + e.height / 2, { steps: 5 });
  await page.mouse.up();
  const [w1, h1] = (await chip.innerText()).split(" × ").map(Number);
  expect(w1).toBeLessThan(w0);
  expect(Math.abs(h1 - h0)).toBeLessThanOrEqual(1);
  await chip.click();
  await page.locator(".ov-size-pop").getByRole("button", { name: "S", exact: true }).click();
  await expect(chip).toHaveText(/^160 × \d+$/);
});

test("scale several blocks together and match their sizes", async ({ page }) => {
  await builder(page);
  await preview(page).getByText("Jordan Ellis").click();
  await preview(page)
    .getByText("Creative Director")
    .click({ modifiers: ["Shift"] });
  const before = await shadowHtml(page);
  await page.getByTestId("group-larger").click();
  await expect.poll(() => shadowHtml(page)).not.toBe(before);
  await page.getByTestId("group-match").click();
});

test("the canvas says whether the signature fits a phone, and fits it on request", async ({ page }) => {
  await builder(page);
  await expect(page.getByTestId("phone-fit")).toContainText("px wide");
  await page.getByTestId("phone-fit").getByRole("button", { name: "Show phone guide" }).click();
  await expect(page.getByTestId("phone-guide")).toBeVisible();
  // Make it too wide, then fit.
  await page.getByTestId("tab-style").click();
  await page.locator(".panel").getByTestId("scale").fill("1.5");
  await expect(page.getByTestId("fit-phone")).toBeVisible();
  await page.getByTestId("fit-phone").click();
  await expect(page.getByTestId("phone-fit")).toContainText("fits phones");
});

test("phone: the inspector is a bottom sheet that folds down", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app");
  await page.getByTestId("template-corporate-classic").click();
  await page.getByTestId("more-menu").click();
  await page.getByTestId("menu-mode").click();
  await expect(preview(page)).toContainText("Jordan Ellis");
  await preview(page).getByText("Jordan Ellis").click();
  const insp = page.getByTestId("inspector");
  await expect(insp).toHaveCSS("position", "fixed");
  const tall = (await insp.boundingBox())!.height;
  await page.getByTestId("sheet-grip").click();
  await expect(insp).toHaveClass(/sheet-peek/);
  await expect.poll(async () => (await insp.boundingBox())!.height).toBeLessThan(tall);
  await shot(page, "99-phone-sheet");
});
