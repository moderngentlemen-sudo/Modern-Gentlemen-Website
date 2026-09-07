import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const local = url && ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);
const email = process.env.E2E_ADMIN_EMAIL,
  password = process.env.E2E_ADMIN_PASSWORD;
test.describe("grid canvas and widget studio", () => {
  test.skip(!local || !key || !email || !password, "Isolated local fixtures and admin required");
  let id: string, slug: string;
  test.beforeEach(async () => {
    slug = `e2e-grid-${Date.now().toString(36)}`;
    const sections = [
      {
        _key: "grid",
        _type: "gridLayout",
        settings: { gap: 24, rowHeight: 48, mobileGap: 16 },
        children: [
          {
            _key: "heading",
            _type: "nativeHeading",
            settings: { text: "Grid heading" },
            visual: { grid: { desktop: { column: 1, row: 1, span: 6, rows: 1 } } },
          },
          {
            _key: "tabs",
            _type: "widgetStudio",
            settings: {
              variant: "tabs",
              title: "Details",
              typography: {
                controls: { fontSize: 20, letterSpacing: 0.05 },
                body: { fontSize: 18, lineHeight: 1.6 },
              },
              items: [
                { title: "One", text: "First panel" },
                { title: "Two", text: "Second panel" },
              ],
            },
            visual: { grid: { desktop: { column: 7, row: 1, span: 6, rows: 1 } } },
          },
        ],
      },
      { _key: "free", _type: "nativeHeading", settings: { text: "Free heading" } },
    ];
    const { data, error } = await createClient(url!, key!, { auth: { persistSession: false } })
      .from("pages")
      .insert({
        title: "Grid fixture",
        slug,
        status: "published",
        published_at: new Date().toISOString(),
        draft_data: { sections },
        published_data: { sections },
      })
      .select("id")
      .single();
    if (error) throw error;
    id = data.id;
  });
  test.afterEach(async () => {
    if (id) {
      const { error } = await createClient(url!, key!, { auth: { persistSession: false } })
        .from("pages")
        .delete()
        .eq("id", id);
      if (error) throw error;
    }
  });
  test("public responsive placement, tabs and accessibility", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/${slug}`);
    const grid = page.locator("[data-grid-layout]");
    const heading = grid.getByRole("heading", { name: "Grid heading" });
    const tabs = grid.getByRole("tablist");
    const a = await heading.boundingBox(),
      b = await tabs.boundingBox();
    expect(a!.x).toBeLessThan(b!.x);
    await grid.getByRole("tab", { name: "One", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(grid.getByRole("tab", { name: "Two", exact: true })).toBeFocused();
    await expect(grid.getByRole("tabpanel")).toHaveText("Second panel");
    await expect(grid.getByRole("tab", { name: "Two", exact: true })).toHaveCSS(
      "font-size",
      "20px"
    );
    await expect(grid.getByRole("tabpanel")).toHaveCSS("font-size", "18px");
    await page.setViewportSize({ width: 390, height: 900 });
    const ma = await heading.boundingBox(),
      mb = await tabs.boundingBox();
    expect(mb!.y).toBeGreaterThan(ma!.y);
    expect(await grid.evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
    const results = await new AxeBuilder({ page })
      .include("[data-grid-layout]")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
  test("V2 isolates its viewport and round-trips edits back to Original without losing payload keys", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const client = createClient(url!, key!, { auth: { persistSession: false } });
    const { error } = await client
      .from("pages")
      .update({
        draft_data: {
          customV2Sentinel: { retained: true },
          sections: [
            {
              _key: "v2text",
              _type: "nativeHeading",
              settings: { text: "V2 heading" },
              visual: { styles: { desktop: { widthPx: 320 } } },
            },
          ],
        },
      })
      .eq("id", id);
    if (error) throw error;
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email!);
    await page.getByLabel("Password", { exact: true }).fill(password!);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/admin/);
    await page.goto(`/admin/pages/${id}/v2`);
    const canvas = page.frameLocator('iframe[title="Builder V2 canvas"]');
    const node = canvas.locator('[data-v2-block="v2text"]');
    await expect(node).toBeVisible();
    await node.click();
    await expect(canvas.getByRole("button", { name: "V2 resize e", exact: true })).toBeVisible();
    const before = (await node.locator("[data-mg-visual]").boundingBox())!;
    const handle = canvas.getByRole("button", { name: "V2 resize e", exact: true });
    const box = (await handle.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 32, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    await expect
      .poll(async () => (await node.locator("[data-mg-visual]").boundingBox())!.width)
      .toBeGreaterThan(before.width + 20);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect
      .poll(async () => (await node.locator("[data-mg-visual]").boundingBox())!.width)
      .toBeCloseTo(before.width, 0);
    await page.getByRole("button", { name: "mobile", exact: true }).click();
    await expect
      .poll(() => canvas.locator("html").evaluate((e) => e.ownerDocument.defaultView!.innerWidth))
      .toBe(390);
    await page.getByLabel("Text", { exact: true }).fill("Edited in V2");
    await page.keyboard.press("ControlOrMeta+s");
    await expect(page.getByText(/^Saved /)).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: "Return to Original", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/pages/${id}$`));
    await expect(
      page.getByRole("button", { name: "Original builder", exact: true })
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('[data-block-key="v2text"]')).toContainText("Edited in V2");
    const { data, error: readError } = await client
      .from("pages")
      .select("draft_data")
      .eq("id", id)
      .single();
    if (readError) throw readError;
    expect(data.draft_data).toMatchObject({ customV2Sentinel: { retained: true } });
  });
  test("free handles follow moved and resized content, with one-step undo", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email!);
    await page.getByLabel("Password", { exact: true }).fill(password!);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/admin/);
    await page.goto(`/admin/pages/${id}`);
    const frame = page.locator('[data-block-key="free"]');
    await frame.getByRole("heading", { name: "Free heading" }).click();
    await page.getByRole("button", { name: "Canvas builder · Preview", exact: true }).click();
    const drag = async (name: string, dx: number, dy: number) => {
      const handle = page.getByRole("button", { name, exact: true });
      const box = (await handle.boundingBox())!;
      await expect(handle).toBeVisible();
      expect(
        await handle.evaluate((e) => {
          const r = e.getBoundingClientRect();
          return e.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
        })
      ).toBe(true);
      await page.keyboard.down("Alt");
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 6 });
      await page.mouse.up();
      await page.keyboard.up("Alt");
    };
    const before = (await frame.getByRole("heading", { name: "Free heading" }).boundingBox())!;
    await drag("Move freely", -24, 16);
    const visual = frame.locator("[data-mg-visual]");
    await expect(visual).toHaveCount(1);
    const moved = (await visual.boundingBox())!;
    expect(moved.x).toBeLessThan(before.x - 15);
    await drag("Resize element e", -32, 0);
    const resized = (await visual.boundingBox())!;
    expect(resized.width).toBeLessThan(moved.width - 20);
    const edge = (await page
      .getByRole("button", { name: "Resize element e", exact: true })
      .boundingBox())!;
    expect(Math.abs(edge.x + edge.width / 2 - resized.x - resized.width)).toBeLessThan(2);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect.poll(async () => (await visual.boundingBox())!.width).toBeCloseTo(moved.width, 0);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(visual).toHaveCount(0);
  });
  test("resizes with a pointer, undoes once, saves independent mobile placement and inserts widgets inside the grid", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email!);
    await page.getByLabel("Password", { exact: true }).fill(password!);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/admin/);
    await page.goto(`/admin/pages/${id}`);
    await page
      .locator('[data-block-key="heading"]')
      .getByRole("heading", { name: "Grid heading" })
      .click();
    const handle = page.getByRole("button", { name: "Resize grid element", exact: true });
    await expect(handle).toBeVisible();
    await page.getByRole("button", { name: "Canvas builder · Preview", exact: true }).click();
    await expect(page.getByRole("button", { name: "Resize grid e", exact: true })).toBeVisible();
    await page.getByLabel("Gradient direction", { exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator('[data-block-key="heading"] [style*="linear-gradient"]')).toHaveCount(
      1
    );
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(page.locator('[data-block-key="heading"] [style*="linear-gradient"]')).toHaveCount(
      0
    );
    await page.getByLabel("Section background colour", { exact: true }).fill("#eeeeee");
    await expect(page.locator('[data-block-key="heading"] [data-page-presentation]')).toHaveCSS(
      "background-color",
      "rgb(238, 238, 238)"
    );
    await page.getByRole("button", { name: "Clear section background media", exact: true }).click();
    await expect(page.locator('[data-block-key="heading"] [data-page-presentation]')).toHaveCount(
      0
    );
    await page.getByRole("button", { name: "Original builder", exact: true }).click();
    await expect(page.getByRole("button", { name: "Resize grid e", exact: true })).toHaveCount(0);
    await expect(handle).toBeVisible();
    const box = (await handle.boundingBox())!;
    const step = await page
      .locator("[data-grid-layout]")
      .evaluate(
        (e) => (e.getBoundingClientRect().width + parseFloat(getComputedStyle(e).columnGap)) / 12
      );
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + step, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();
    await expect(page.getByRole("spinbutton", { name: "Column span", exact: true })).toHaveValue(
      "7"
    );
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(page.getByRole("spinbutton", { name: "Column span", exact: true })).toHaveValue(
      "6"
    );
    await page.getByRole("button", { name: "Move grid element", exact: true }).press("ArrowDown");
    await expect(page.getByRole("spinbutton", { name: "Row", exact: true })).toHaveValue("2");
    await page.getByRole("button", { name: "mobile", exact: true }).click();
    await expect(page.getByRole("spinbutton", { name: "Column span", exact: true })).toHaveValue(
      "12"
    );
    await page.getByRole("spinbutton", { name: "Column span", exact: true }).fill("8");
    await page.getByRole("button", { name: "desktop", exact: true }).click();
    await expect(page.getByRole("spinbutton", { name: "Column span", exact: true })).toHaveValue(
      "6"
    );
    await page.getByRole("button", { name: "Drag Grid canvas", exact: true }).click();
    await page.getByRole("button", { name: "Widgets", exact: true }).click();
    await page.getByRole("button", { name: /^Accordion Expandable/ }).click();
    await expect(page.locator('[data-block-key="grid"] [data-block-key]')).toHaveCount(3);
    await page.keyboard.press("ControlOrMeta+s");
    await expect(page.getByText(/^Saved /)).toBeVisible({ timeout: 15000 });
    await page.reload();
    await expect(page.locator('[data-block-key="grid"] [data-block-key]')).toHaveCount(3);
  });
});
