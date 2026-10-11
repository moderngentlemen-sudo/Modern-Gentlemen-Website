import { expect, test, type Page } from "@playwright/test";
import { canvaPng, shot } from "./helpers";

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

test("a logo's side edge changes only its width, and the top edge only its height", async ({ page }) => {
  await builder(page);
  await page.getByTestId("tab-content").click();
  await page.getByTestId("tab-images").click();
  const png = await canvaPng(page, { width: 600, height: 200, margin: 0 });
  await page.getByTestId("upload-logo").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: png });
  await preview(page).locator('img[alt$="logo"]').first().click();
  const chip = page.getByTestId("size-chip");
  await expect(chip).toHaveText(/^\d+ × \d+$/);
  const size = async () => (await chip.innerText()).split(" × ").map(Number);
  const drag = async (dir: string, dx: number, dy: number) => {
    const h = (await page.getByTestId(`resize-handle-${dir}`).boundingBox())!;
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
    await page.mouse.down();
    await page.mouse.move(h.x + h.width / 2 + dx, h.y + h.height / 2 + dy, { steps: 5 });
    await page.mouse.up();
  };
  const [w0, h0] = await size();
  await drag("e", 40, 0);
  const [w1, h1] = await size();
  expect(w1).toBeGreaterThan(w0);
  expect(Math.abs(h1 - h0)).toBeLessThanOrEqual(1);
  await drag("n", 0, -20);
  const [w2, h2] = await size();
  expect(Math.abs(w2 - w1)).toBeLessThanOrEqual(1);
  expect(h2).toBeGreaterThan(h1);
  // The rendered logo's frame really has that shape; the picture is cropped to fill it, never squashed.
  const frame = preview(page).locator('img[alt$="logo"]').first().locator("xpath=..");
  const box = (await frame.boundingBox())!;
  expect(Math.abs(box.width / box.height - w2 / h2)).toBeLessThan(0.05);
  const img = (await preview(page).locator('img[alt$="logo"]').first().boundingBox())!;
  expect(Math.abs(img.width / img.height - 3)).toBeLessThan(0.05);
});

test("start from scratch opens an empty canvas, with no template or sample details", async ({ page }) => {
  await page.goto("/app");
  await page.getByTestId("start-blank").click();
  await expect(page.getByTestId("mode-builder")).toHaveAttribute("aria-pressed", "true");
  await expect(preview(page)).toContainText("Drop blocks here");
  await expect(preview(page).locator("[data-block]")).toHaveCount(0);
  // Adding a block shows the person's own (here: empty) details, not a sample name.
  await page.getByTestId("palette-name").click();
  await expect(preview(page).locator("[data-block]")).toHaveCount(1);
  await expect(preview(page)).not.toContainText("Jordan Ellis");
});

test("dividers: colour, line style, spacing, padding and a vertical direction", async ({ page }) => {
  await builder(page);
  await page.getByTestId("palette-divider").scrollIntoViewIfNeeded();
  await page.getByTestId("palette-divider").click();
  const insp = page.getByTestId("inspector");
  // Colour now changes the line.
  await insp.getByRole("button", { name: /^Line colour:/ }).click();
  await insp.getByLabel("Line colour hex").fill("#c8102e");
  await page.keyboard.press("Enter");
  await expect.poll(() => shadowHtml(page)).toContain("#c8102e");
  await insp.getByRole("group", { name: "Line style" }).getByRole("button", { name: "Dashed" }).click();
  await insp.getByLabel("Spacing value").fill("14");
  await insp.getByLabel("Padding value").fill("24");
  await expect.poll(() => shadowHtml(page)).toContain("padding:14px 24px;");
  expect(await shadowHtml(page)).toContain("border-top:1px dashed #c8102e");
  // Vertical: the handles grow it up and down.
  await insp.getByRole("group", { name: "Divider direction" }).getByRole("button", { name: "Vertical" }).click();
  await expect.poll(() => shadowHtml(page)).toContain("border-left:1px dashed #c8102e");
  await expect(page.getByTestId("size-chip")).toHaveText("48px tall");
  await expect(page.getByTestId("resize-handle-s")).toBeVisible();
  await shot(page, "104-divider");
});

test("contacts: the frame covers every line, edges change the spacing, icons and dividers can be changed", async ({ page }) => {
  await builder(page);
  await preview(page).getByText("+1 416 555 0182").click();
  // The selection reaches past the longest line (the email), so the side handle isn't on top of it.
  const email = (await preview(page).getByText("jordan@moderngentlemen.co").first().boundingBox())!;
  const se = (await page.getByTestId("resize-handle").boundingBox())!;
  expect(se.x + se.width / 2).toBeGreaterThanOrEqual(email.x + email.width - 1);
  // A list has no side handles; its bottom edge spreads the rows.
  await expect(page.getByTestId("resize-handle-e")).toHaveCount(0);
  const before = await shadowHtml(page);
  const s = (await page.getByTestId("resize-handle-s").boundingBox())!;
  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
  await page.mouse.down();
  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2 + 30, { steps: 5 });
  await page.mouse.up();
  const insp = page.getByTestId("inspector");
  await expect(insp.getByLabel("Space between rows value")).not.toHaveValue("3");
  await expect(page.getByTestId("size-chip")).toContainText("px text");
  expect(await shadowHtml(page)).not.toBe(before);

  // Icons off.
  await expect(preview(page).locator('img[alt="Phone"]')).toHaveCount(1);
  await insp.getByTestId("contact-icons").click();
  await expect(preview(page).locator('img[alt="Phone"]')).toHaveCount(0);

  // One line: a dot divider in red, more space.
  await insp.getByRole("group", { name: "Contacts layout" }).getByRole("button", { name: "One line" }).click();
  await insp.getByRole("group", { name: "Contact dividers" }).getByRole("button", { name: "Dot" }).click();
  await insp.getByRole("button", { name: /^Divider colour:/ }).click();
  await insp.getByLabel("Divider colour hex").fill("#c8102e");
  await page.keyboard.press("Enter");
  await insp.getByLabel("Space between value").fill("30");
  await expect.poll(() => shadowHtml(page)).toMatch(/color:#c8102e;padding:0 \d+px;">·<\/span>/);
  await shot(page, "105-contacts");
});

test("contacts: dividers in a list and a grid, a wide space across, and a link per field", async ({ page }) => {
  await builder(page);
  await preview(page).getByText("+1 416 555 0182").click();
  const insp = page.getByTestId("inspector");
  // A list: lines between rows.
  await insp.getByRole("group", { name: "Lines between rows" }).getByRole("button", { name: "Dotted" }).click();
  await expect.poll(() => shadowHtml(page)).toContain("border-top:1px dotted");
  // A grid: a symbol between the two columns, and much more space across.
  await insp.getByRole("group", { name: "Contacts layout" }).getByRole("button", { name: "Grid" }).click();
  await insp.getByRole("group", { name: "Contact dividers" }).getByRole("button", { name: "Bar" }).click();
  await insp.getByLabel("Space across value").fill("150");
  await expect.poll(() => shadowHtml(page)).toContain("75px 0 0;");
  // Links: the address goes to a map, the phone to nothing.
  await insp.getByLabel("Address link", { exact: true }).selectOption("custom");
  await insp.getByTestId("contact-link-address").fill("https://maps.google.com/?q=88+Yorkville");
  await insp.getByLabel("Phone link", { exact: true }).selectOption("none");
  await expect.poll(() => shadowHtml(page)).toContain('href="https://maps.google.com/?q=88+Yorkville"');
  expect(await shadowHtml(page)).not.toContain('href="tel:');
  await shot(page, "106-contacts-links");
});

test("text and button edges reshape instead of scaling", async ({ page }) => {
  await builder(page);
  const drag = async (dir: string, dx: number, dy: number) => {
    const h = (await page.getByTestId(dir === "se" ? "resize-handle" : `resize-handle-${dir}`).boundingBox())!;
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
    await page.mouse.down();
    await page.mouse.move(h.x + h.width / 2 + dx, h.y + h.height / 2 + dy, { steps: 5 });
    await page.mouse.up();
  };
  // A one-line job title: side handles, no top or bottom ones.
  await preview(page).getByText("Creative Director").click();
  await expect(page.getByTestId("resize-handle-e")).toBeVisible();
  await expect(page.getByTestId("resize-handle-n")).toHaveCount(0);
  const chip = page.getByTestId("size-chip");
  const size0 = await chip.innerText();
  await drag("e", 60, 0);
  // The text keeps its size; the box got wider.
  await expect(chip).toHaveText(size0);
  await expect.poll(() => shadowHtml(page)).toMatch(/width="\d+"/);
  await expect(page.getByTestId("inspector").getByLabel("Text box width value")).not.toHaveValue("0");

  // A button: wider from the side, taller from the bottom.
  await page.getByTestId("palette-button").scrollIntoViewIfNeeded();
  await page.getByTestId("palette-button").click();
  const insp = page.getByTestId("inspector");
  await insp.getByLabel("Button text").fill("Book a call");
  await insp.getByLabel("Link", { exact: true }).fill("cal.com/jordan");
  const box0 = (await page.locator(".ov-select").boundingBox())!;
  await drag("e", 40, 0);
  await drag("s", 0, 10);
  const box1 = (await page.locator(".ov-select").boundingBox())!;
  expect(Math.round(box1.width - box0.width)).toBeGreaterThanOrEqual(38);
  // The bottom edge follows the pointer: 10px down, 10px taller.
  expect(Math.round(box1.height - box0.height)).toBeGreaterThanOrEqual(9);
  await expect(chip).toHaveText(size0);
});

test("phone view: changes apply to the phone layout only, and desktop changes still reach it", async ({ page }) => {
  await builder(page);
  const device = async (name: "Phone" | "Desktop") => {
    await page.getByTestId("view-menu").click();
    await page.getByRole("group", { name: "Device" }).getByRole("button", { name: name }).click();
    await page.keyboard.press("Escape");
  };
  // A text block made on desktop.
  await page.getByTestId("palette-text").scrollIntoViewIfNeeded();
  await page.getByTestId("palette-text").click();
  await page.getByTestId("inspector-text").fill("Hello from desktop");
  await expect(preview(page)).toContainText("Hello from desktop");

  await device("Phone");
  await expect(page.getByTestId("phone-bar")).toContainText("phones only");
  // On the phone: delete the job title and centre the name.
  await preview(page).getByText("Creative Director").click();
  await page.getByTestId("delete-block").click();
  await expect(preview(page)).not.toContainText("Creative Director");
  await expect(page.getByTestId("phone-bar")).toContainText("Phone layout");

  // Desktop still has it.
  await device("Desktop");
  await expect(preview(page)).toContainText("Creative Director");
  // A desktop edit to the text block flows to the phone layout.
  await preview(page).getByText("Hello from desktop").click();
  await page.getByTestId("inspector-text").fill("Hello everywhere");
  await device("Phone");
  await expect(preview(page)).toContainText("Hello everywhere");
  await expect(preview(page)).not.toContainText("Creative Director");
  await shot(page, "107-phone-layout");

  // Match desktop: phones go back to the desktop layout.
  await page.getByTestId("phone-reset").click();
  await expect(preview(page)).toContainText("Creative Director");
  await expect(page.getByTestId("phone-bar")).not.toContainText("Phone layout");
});
