import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const local = url && ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);
const email = process.env.E2E_ADMIN_EMAIL,
  password = process.env.E2E_ADMIN_PASSWORD;

/**
 * Focus, the unified editor: rail panes, hover previews with an on-canvas
 * insertion marker, the floating inspector and its docked mode.
 */
test.describe("Focus editor", () => {
  test.skip(!local || !key || !email || !password, "Isolated local fixtures and admin required");
  let id: string;
  test.beforeEach(async ({ page }) => {
    const sections = [
      { _key: "head", _type: "nativeHeading", settings: { text: "Focus heading" } },
      { _key: "body", _type: "nativeText", settings: { text: "Focus body copy." } },
    ];
    const { data, error } = await createClient(url!, key!, { auth: { persistSession: false } })
      .from("pages")
      .insert({
        title: "Focus fixture",
        slug: `e2e-focus-${Date.now().toString(36)}`,
        status: "draft",
        draft_data: { sections },
      })
      .select("id")
      .single();
    if (error) throw error;
    id = data.id;
    await page.addInitScript(() => localStorage.setItem("mg-editor-experience", "focus"));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email!);
    await page.getByLabel("Password", { exact: true }).fill(password!);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/admin/);
  });
  test.afterEach(async () => {
    if (!id) return;
    const { error } = await createClient(url!, key!, { auth: { persistSession: false } })
      .from("pages")
      .delete()
      .eq("id", id);
    if (error) throw error;
  });

  test("previews while browsing, inserts where it showed, and floats or docks the inspector", async ({
    page,
  }) => {
    await page.goto(`/admin/pages/${id}`);
    const rail = page.getByRole("navigation", { name: "Editor tools" });
    await expect(rail).toBeVisible();

    // Browse sections: the real block renders beside the pane, and a marker
    // shows where it would land (the end of the page, with nothing selected).
    await rail.getByRole("button", { name: "Insert", exact: true }).click();
    const pane = page.locator('[data-focus-pane="insert"]');
    const entry = pane.locator("li button").first();
    await entry.hover();
    await expect(page.locator("[data-block-preview]")).toBeVisible();
    await expect(page.locator("[data-insertion-marker]")).toContainText("end of the page");

    // Widgets preview on hover too.
    await pane.getByRole("button", { name: "Widgets & elements" }).click();
    await pane.locator("button").filter({ hasText: /./ }).nth(2).hover();
    await expect(page.locator("[data-widget-preview]")).toBeVisible();

    // Select the heading: the inspector floats beside it, and the marker now
    // says the next insert goes after it.
    await page
      .locator('[data-block-key="head"]')
      .getByRole("heading", { name: "Focus heading" })
      .click();
    const floating = page.locator('[data-floating-inspector="head"]');
    await expect(floating).toBeVisible();
    const block = (await page.locator('[data-block-key="head"]').boundingBox())!;
    const card = (await floating.boundingBox())!;
    expect(card.x > block.x + block.width - 1 || card.x + card.width < block.x + 1).toBe(true);

    await pane.getByRole("button", { name: "Sections & patterns" }).click();
    await entry.hover();
    await expect(page.locator("[data-insertion-marker]")).toContainText("Inserts after");
    const before = await page.locator("[data-block-key]").count();
    await entry.click();
    await expect(page.locator("[data-block-key]")).toHaveCount(before + 1);

    // Dock the inspector; the choice survives a reload.
    await page
      .locator('[data-block-key="head"]')
      .getByRole("heading", { name: "Focus heading" })
      .click();
    await page.getByRole("button", { name: "Dock", exact: true }).click();
    await expect(page.locator("[data-floating-inspector]")).toHaveCount(0);
    await expect(page.getByRole("complementary", { name: "Inspector" })).toBeVisible();
    await page.reload();
    await page
      .locator('[data-block-key="head"]')
      .getByRole("heading", { name: "Focus heading" })
      .click();
    await expect(page.getByRole("button", { name: "Float", exact: true })).toBeVisible();

    // Shortcut sheet and layout switch are reachable from the rail.
    await page.keyboard.press("Escape");
    await page.keyboard.press("?");
    await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
    await page.keyboard.press("Escape");
    await rail.getByRole("button", { name: "Editor layout" }).click();
    await page.getByRole("button", { name: "Original builder", exact: true }).click();
    await expect(rail).toHaveCount(0);
  });
});
