import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { EDITORIAL_COLLECTION } from "../../lib/domain/editorialCollection";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;
const local = url && ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email!);
  await page.getByLabel("Password", { exact: true }).fill(password!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin/);
}
async function publish(page: Page) {
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: /Publish/ });
  await expect(dialog.getByText("No issues")).toBeVisible();
  await dialog.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByText(/Published v\d+/)).toBeVisible();
}

test.describe("MG 90 collection", () => {
  test.skip(!local || !key || !email || !password, "Requires the isolated seeded CI stack.");
  let createdDocument: { table: "pages" | "articles"; id: string } | undefined;
  test.beforeEach(async ({ page }) => {
    createdDocument = undefined;
    page.setDefaultTimeout(15_000);
    await page.setViewportSize({ width: 1600, height: 1000 });
    await signIn(page);
  });
  test.afterEach(async () => {
    if (!createdDocument) return;
    const result = await createClient(url!, key!, { auth: { persistSession: false } })
      .from(createdDocument.table)
      .delete()
      .eq("id", createdDocument.id);
    if (result.error) throw result.error;
  });

  test("chooses a live design, inserts all 60 sections, edits, saves and publishes", async ({
    page,
  }, info) => {
    test.setTimeout(300_000);
    const stamp = Date.now().toString(36);
    const slug = `e2e-mg90-page-${stamp}`;
    const chosen = EDITORIAL_COLLECTION.find((c) => c.id === "34")!;
    await page.goto("/admin/editorial-collection");
    const count = page.getByRole("status", { name: "Collection results" });
    await expect(count).toHaveText("90 designs");
    await page.getByRole("combobox", { name: "Format", exact: true }).selectOption("article");
    await expect(count).toHaveText("30 designs");
    await page.getByRole("combobox", { name: "Format", exact: true }).selectOption("section");
    await expect(count).toHaveText("60 designs");
    await page.getByRole("searchbox", { name: "Search the collection" }).fill(chosen.name);
    await expect(count).toHaveText("1 design");
    await page.getByRole("button", { name: new RegExp(`${chosen.name}.*Explore design`) }).click();
    const dialog = page.getByRole("dialog", { name: chosen.name });
    await expect(dialog.getByRole("img")).toBeVisible();
    for (const mode of ["desktop", "mobile"]) {
      await dialog.getByRole("button", { name: `Live ${mode}`, exact: true }).click();
      const preview = page.frameLocator(`iframe[title="${chosen.name} live ${mode} layout"]`);
      await expect(preview.locator('[data-mg-collection="34"]')).toBeVisible();
      await info.attach(`collection-preview-${mode}`, {
        body: await dialog.screenshot(),
        contentType: "image/png",
      });
    }
    await dialog.getByRole("textbox", { name: "Title", exact: true }).fill(`MG 90 page ${stamp}`);
    await dialog.getByRole("textbox", { name: "URL slug", exact: true }).fill(slug);
    await dialog.getByRole("button", { name: "Use this design", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/pages\/[0-9a-f-]{36}$/);
    createdDocument = { table: "pages", id: page.url().split("/").pop()! };
    const origin = new URL(page.url()).origin;
    await page
      .getByRole("textbox", { name: "Add a section", exact: true })
      .fill("MG 90 collection");
    for (const c of EDITORIAL_COLLECTION.filter((c) => c.kind === "section" && c.id !== "34")) {
      await page.getByRole("button", { name: new RegExp(`^MG ${c.id} ·`) }).click();
    }
    const blocks = page.locator("[data-block-key]");
    await expect(blocks).toHaveCount(60);
    const edition = blocks.locator('[data-mg-collection="01"]');
    await edition.getByRole("heading", { level: 2 }).click();
    await page.getByRole("textbox", { name: "Heading", exact: true }).fill("An authored edition");
    await page.getByRole("button", { name: "Canvas builder · Preview", exact: true }).click();
    await expect(edition.getByRole("heading", { name: "An authored edition" })).toBeVisible();
    await page.keyboard.press("ControlOrMeta+s");
    await expect(page.getByText(/^Saved /)).toBeVisible();
    await page.reload();
    await expect(blocks).toHaveCount(60);
    await expect(blocks.locator("img")).toHaveCount(0);
    await publish(page);

    const publicContext = await page.context().browser()!.newContext({ reducedMotion: "reduce" });
    const publicPage = await publicContext.newPage();
    try {
      await publicPage.goto(`${origin}/${slug}`);
      await expect(publicPage.locator("[data-mg-collection]")).toHaveCount(60);
      await expect(publicPage.getByRole("heading", { name: "An authored edition" })).toBeVisible();
      for (const theme of ["light", "dark"]) {
        await publicPage.evaluate((value) => {
          document.documentElement.dataset.mgtheme = value;
        }, theme);
        for (const width of [1440, 390]) {
          await publicPage.setViewportSize({ width, height: 900 });
          expect(
            await publicPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)
          ).toBe(true);
          const results = await new AxeBuilder({ page: publicPage })
            .include("[data-mg-collection]")
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze();
          expect(results.violations).toEqual([]);
          await info.attach(`native-edition-${theme}-${width}`, {
            body: await publicPage.locator('[data-mg-collection="01"]').screenshot(),
            contentType: "image/png",
          });
        }
      }
      const question = publicPage.locator('[data-mg-collection="11"] details').first();
      await question.locator("summary").focus();
      await publicPage.keyboard.press("Enter");
      await expect(question).toHaveAttribute("open", "");
      const materials = publicPage.locator('[data-mg-collection="34"]');
      await materials.getByRole("button").nth(1).click();
      await expect(materials.getByRole("button").nth(1)).toHaveAttribute("aria-pressed", "true");
    } finally {
      await publicContext.close();
    }
  });

  test("creates a complete article template, retains its layout and publishes its body", async ({
    page,
  }, info) => {
    test.setTimeout(180_000);
    const stamp = Date.now().toString(36);
    const slug = `e2e-mg90-article-${stamp}`;
    await page.goto("/admin/editorial-collection?concept=61");
    const dialog = page.getByRole("dialog");
    await dialog
      .getByRole("textbox", { name: "Title", exact: true })
      .fill(`MG 90 article ${stamp}`);
    await dialog.getByRole("textbox", { name: "URL slug", exact: true }).fill(slug);
    await dialog.getByRole("button", { name: "Use this design", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/articles\/[0-9a-f-]{36}$/);
    createdDocument = { table: "articles", id: page.url().split("/").pop()! };
    const origin = new URL(page.url()).origin;
    await expect(page.getByLabel("Article design", { exact: true })).toHaveValue("collection-61");
    await page.getByRole("button", { name: "Save details", exact: true }).click();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Article design", { exact: true })).toHaveValue("collection-61");
    await page.getByRole("link", { name: "Compose sections", exact: true }).click();
    await expect(page.locator('[data-block-key] [data-mg-collection="61"]')).toBeVisible();
    await expect(page.locator("[data-block-key] img")).toHaveCount(0);
    await publish(page);
    const publicContext = await page.context().browser()!.newContext({ reducedMotion: "reduce" });
    const publicPage = await publicContext.newPage();
    try {
      await publicPage.goto(`${origin}/article/${slug}`);
      await expect(publicPage.locator('[data-article-design="collection-61"]')).toBeVisible();
      await expect(publicPage.locator('[data-mg-collection="61"]')).toBeVisible();
      await expect(publicPage.getByRole("heading", { level: 1 })).toHaveText(
        `MG 90 article ${stamp}`
      );
      for (const width of [1440, 390]) {
        await publicPage.setViewportSize({ width, height: 900 });
        expect(
          await publicPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)
        ).toBe(true);
        await info.attach(`native-article-${width}`, {
          body: await publicPage.screenshot({ fullPage: true }),
          contentType: "image/png",
        });
      }
      const results = await new AxeBuilder({ page: publicPage })
        .include('[data-article-design="collection-61"]')
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(results.violations).toEqual([]);
    } finally {
      await publicContext.close();
    }
  });
});
