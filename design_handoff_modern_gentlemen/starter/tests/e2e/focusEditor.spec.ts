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
      { _key: "body", _type: "nativeText", settings: { content: "Focus body copy." } },
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
    // A section entry, not a pattern: built-in layouts lead the rail.
    const entry = pane.locator("[data-library-block]").first();
    await entry.hover();
    await expect(page.locator("[data-block-preview]")).toBeVisible();
    await expect(page.locator("[data-insertion-marker]")).toContainText("end of the page");

    // Widgets preview on hover too.
    await pane.getByRole("button", { name: "Widgets & elements" }).click();
    await pane.locator("[data-widget-item]").first().hover();
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
    // Beside the block when there is room, else above or below it: never on top of it.
    const apart =
      card.x >= block.x + block.width - 1 ||
      card.x + card.width <= block.x + 1 ||
      card.y >= block.y + block.height - 1 ||
      card.y + card.height <= block.y + 1;
    expect(apart).toBe(true);

    await pane.getByRole("button", { name: "Sections & patterns" }).click();
    await entry.hover();
    await expect(page.locator("[data-insertion-marker]")).toContainText("Inserts after");
    const before = await page.locator("[data-block-key]").count();
    await entry.click();
    await expect(page.locator("[data-block-key]")).toHaveCount(before + 1);

    // Dock the inspector; the choice survives a reload. Clicks land near the
    // heading's top-left: the block just inserted below it is selected, and its
    // "Move freely" handle straddles the boundary over the heading's centre.
    await page
      .locator('[data-block-key="head"]')
      .getByRole("heading", { name: "Focus heading" })
      .click({ position: { x: 12, y: 12 } });
    await page.getByRole("button", { name: "Dock", exact: true }).click();
    await expect(page.locator("[data-floating-inspector]")).toHaveCount(0);
    await expect(page.getByRole("complementary", { name: "Inspector" })).toBeVisible();
    await page.reload();
    await page
      .locator('[data-block-key="head"]')
      .getByRole("heading", { name: "Focus heading" })
      .click({ position: { x: 12, y: 12 } });
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
  test("command bar, history travel, selection bar and device compare", async ({ page }) => {
    await page.goto(`/admin/pages/${id}`);
    const rail = page.getByRole("navigation", { name: "Editor tools" });
    await expect(rail).toBeVisible();

    // Ctrl/⌘K inserts with the same on-canvas preview as the pane.
    await page.keyboard.press("ControlOrMeta+k");
    const search = page.getByRole("combobox", { name: "Search commands" });
    await search.fill("insert divider");
    await expect(page.locator("[data-insertion-marker]")).toBeVisible();
    const before = await page.locator("[data-block-key]").count();
    await search.press("Enter");
    await expect(page.locator("[data-block-key]")).toHaveCount(before + 1);

    // History names the step and travels back to the start.
    await rail.getByRole("button", { name: "History", exact: true }).click();
    const history = page.getByRole("list", { name: "Edit history" });
    await expect(history).toContainText("Added Divider");
    await history.getByText("Where this session began").click();
    await expect(page.locator("[data-block-key]")).toHaveCount(before);
    await history.getByText("Added Divider").click();
    await expect(page.locator("[data-block-key]")).toHaveCount(before + 1);

    // Two blocks selected: the selection bar acts on both in one step.
    await page.locator('[data-block-key="head"]').getByRole("heading").click();
    await page.locator('[data-block-key="body"]').click({ modifiers: ["Shift"] });
    const bar = page.getByRole("toolbar", { name: "2 blocks selected" });
    await expect(bar).toBeVisible();
    await bar.getByRole("button", { name: "Lock" }).click();
    await expect(bar.getByRole("button", { name: "Unlock" })).toBeVisible();

    // Compare devices frames a real preview link at three widths.
    await rail.getByRole("button", { name: "Compare devices" }).click();
    await expect(page.locator("[data-compare-frame]")).toHaveCount(3);
    await expect(page.locator('[data-compare-frame="mobile"]')).toHaveAttribute(
      "src",
      /\/preview\//
    );
  });
  test("schedules a draft from the publish menu and cancels it again", async ({ page }) => {
    await page.goto(`/admin/pages/${id}`);
    await page.getByRole("button", { name: "More publishing options" }).click();
    await page.getByRole("menuitem", { name: /Schedule/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Tomorrow, 9:00" }).click();
    await dialog.getByRole("button", { name: "Schedule", exact: true }).click();
    await expect(page.getByText(/^Publishes /)).toBeVisible();

    // The schedule survives a reload: it is the row's status, not page state.
    await page.reload();
    await expect(page.getByText(/^Publishes /)).toBeVisible();

    await page.getByRole("button", { name: "More publishing options" }).click();
    await page.getByRole("menuitem", { name: "Cancel schedule" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Cancel schedule" }).click();
    await expect(page.getByText(/^Publishes /)).toHaveCount(0);
  });
});
