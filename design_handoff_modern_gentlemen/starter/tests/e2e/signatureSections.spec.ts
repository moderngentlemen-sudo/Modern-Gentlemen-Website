import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { MG_SIGNATURE_SECTIONS } from "../../lib/blocks/mgSignatureSections";

const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;
const databaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const local =
  databaseUrl && ["localhost", "127.0.0.1", "[::1]"].includes(new URL(databaseUrl).hostname);

test.describe("MG signature collection", () => {
  test.skip(!local || !email || !password, "Requires the isolated seeded CI stack and editor");
  let title: string;
  let created = false;

  test.afterEach(async ({ page }) => {
    if (!created) return;
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/pages");
    const row = page
      .getByRole("row")
      .filter({ has: page.getByRole("link", { name: title, exact: true }) });
    await row.getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByRole("button", { name: "Delete page", exact: true }).click();
    await expect(page.getByRole("link", { name: title, exact: true })).toHaveCount(0);
  });

  test("inserts all 24 sections, edits in both builders, saves, reopens and publishes", async ({
    page,
  }, info) => {
    test.setTimeout(240_000);
    page.setDefaultTimeout(15_000);
    created = false;
    const stamp = Date.now().toString(36);
    title = `E2E signature collection ${stamp}`;
    const slug = `e2e-signature-${stamp}`;
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email!);
    await page.getByLabel("Password", { exact: true }).fill(password!);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/admin/);
    await page.goto("/admin/pages");
    await page.getByRole("button", { name: "New page", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "New page" });
    // Required markers are aria-hidden; role names exclude them, label text does not.
    await dialog.getByRole("textbox", { name: "Title", exact: true }).fill(title);
    await dialog.getByRole("textbox", { name: "Slug", exact: true }).fill(slug);
    await dialog.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/pages\/[0-9a-f-]{36}$/);
    created = true;
    const editorUrl = page.url();

    await page.getByLabel("Add a section", { exact: true }).fill("Signature collection");
    for (const { name } of MG_SIGNATURE_SECTIONS) {
      await page.getByRole("button", { name: new RegExp(`^MG · ${name}`) }).click();
    }
    const blocks = page.locator("[data-block-key]");
    await expect(blocks).toHaveCount(24);
    const cover = blocks.locator('[data-mg-signature="coverStory"]');
    await cover.getByRole("heading", { level: 2 }).click();
    await page
      .getByRole("textbox", { name: "Heading", exact: true })
      .fill("An authored cover story");
    await page.getByRole("button", { name: "Canvas builder · Preview", exact: true }).click();
    await expect(cover.getByRole("heading", { name: "An authored cover story" })).toBeVisible();
    await page
      .getByRole("textbox", { name: "Introduction", exact: true })
      .fill("Saved through the Canvas builder.");
    await page.keyboard.press("ControlOrMeta+s");
    await expect(page.getByText(/^Saved /)).toBeVisible({ timeout: 15_000 });
    await page.reload();
    await expect(blocks).toHaveCount(24);
    await cover.getByRole("heading", { name: "An authored cover story" }).click();
    await expect(page.getByRole("textbox", { name: "Introduction", exact: true })).toHaveValue(
      "Saved through the Canvas builder."
    );
    // Illustrative picker images must not become the editor's published media.
    await expect(blocks.locator("img")).toHaveCount(0);

    await page.getByRole("button", { name: "Publish", exact: true }).click();
    const publish = page.getByRole("dialog", { name: /Publish/ });
    await expect(publish.getByText("No issues")).toBeVisible();
    await publish.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText(/Published v\d+/)).toBeVisible({ timeout: 15_000 });

    const publicContext = await page.context().browser()!.newContext({ reducedMotion: "reduce" });
    const publicPage = await publicContext.newPage();
    publicPage.setDefaultTimeout(15_000);
    const errors: string[] = [];
    publicPage.on("pageerror", (error) => errors.push(error.message));
    try {
      await publicPage.goto(new URL(`/${slug}`, editorUrl).href);
      await expect(publicPage.locator("[data-mg-signature]")).toHaveCount(24);
      await expect(
        publicPage.getByRole("heading", { name: "An authored cover story" })
      ).toBeVisible();
      for (const theme of ["light", "dark"]) {
        await publicPage.evaluate((value) => {
          localStorage.setItem("mg-theme", value);
          document.documentElement.dataset.mgtheme = value;
        }, theme);
        for (const width of [1440, 390]) {
          await publicPage.setViewportSize({ width, height: 900 });
          await publicPage.evaluate(() => document.fonts.ready);
          for (const { id } of MG_SIGNATURE_SECTIONS) {
            const section = publicPage.locator(`[data-mg-signature="${id}"]`);
            await expect(section).toBeVisible();
            expect(
              await section.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)
            ).toBe(true);
          }
          const results = await new AxeBuilder({ page: publicPage })
            .include("[data-mg-signature]")
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze();
          expect(results.violations).toEqual([]);
          await info.attach(`signature-cover-${theme}-${width}`, {
            body: await publicPage.locator('[data-mg-signature="coverStory"]').screenshot(),
            contentType: "image/png",
          });
        }
      }
      const disclosure = publicPage.locator('[data-mg-signature="inGoodCompany"] details').first();
      await disclosure.locator("summary").focus();
      await publicPage.keyboard.press("Enter");
      await expect(disclosure).toHaveAttribute("open", "");
      await expect(publicPage.getByRole("table")).toBeVisible();
      expect(errors).toEqual([]);
    } finally {
      await publicContext.close();
    }
  });
});
