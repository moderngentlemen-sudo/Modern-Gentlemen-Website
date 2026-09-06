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
              items: [
                { title: "One", text: "First panel" },
                { title: "Two", text: "Second panel" },
              ],
            },
            visual: { grid: { desktop: { column: 7, row: 1, span: 6, rows: 1 } } },
          },
        ],
      },
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
