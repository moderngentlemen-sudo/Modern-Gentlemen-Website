import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const local = url && ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);
const email = process.env.E2E_ADMIN_EMAIL,
  password = process.env.E2E_ADMIN_PASSWORD;

test.describe("page settings", () => {
  test.skip(!local || !key, "Only writes isolated local fixtures");
  let id: string, slug: string;
  test.beforeEach(async () => {
    slug = `e2e-page-settings-${Date.now().toString(36)}`;
    const sections = [
      { _key: "heading", _type: "nativeHeading", settings: { text: "Page settings fixture" } },
    ];
    const pageSettings = {
      backgroundColor: "#f4f4f4",
      fullHeight: true,
      header: "hidden",
      mobileHeader: "inherit",
      footer: "hidden",
      mobileFooter: "hidden",
      seoTitle: "Settings search title",
      description: "Settings description",
      noIndex: true,
    };
    const { data, error } = await createClient(url!, key!, { auth: { persistSession: false } })
      .from("pages")
      .insert({
        title: "Settings fixture",
        slug,
        status: "published",
        published_at: new Date().toISOString(),
        published_data: { sections, pageSettings },
        draft_data: { sections, pageSettings },
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
  test("public presentation, metadata, independent mobile chrome and accessibility", async ({
    page,
  }, testInfo) => {
    await page.addInitScript(() => localStorage.setItem("mg-theme", "light"));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/${slug}`);
    await expect(page).toHaveTitle("Settings search title — Modern Gentlemen");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.locator('[data-site-chrome="header"]')).toBeHidden();
    await expect(page.locator("[data-site-main]")).toHaveCSS("padding-top", "0px");
    await expect(page.locator('[data-page-presentation="public"]')).toHaveCSS(
      "background-color",
      "rgb(244, 244, 244)"
    );
    await page.screenshot({
      path: testInfo.outputPath("page-settings-desktop.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 900 });
    await expect(page.locator('[data-site-chrome="header"] header')).toBeVisible();
    await expect(page.locator('[data-site-chrome="footer"]')).toBeHidden();
    await page.screenshot({
      path: testInfo.outputPath("page-settings-mobile.png"),
      fullPage: true,
    });
    const result = await new AxeBuilder({ page })
      .include('[data-page-presentation="public"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(result.violations).toEqual([]);
  });
  test("edits page settings, saves and reloads without changing published data", async ({
    page,
  }, testInfo) => {
    test.skip(!email || !password, "Admin required");
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email!);
    await page.getByLabel("Password", { exact: true }).fill(password!);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/admin/);
    await page.goto(`/admin/pages/${id}`);
    await page.getByRole("button", { name: "Page Settings", exact: true }).click();
    await page.getByLabel("SEO title", { exact: true }).fill("New draft title");
    await page.getByLabel("Background color", { exact: true }).fill("#eeeeee");
    await page.getByLabel("Mobile header", { exact: true }).selectOption("hidden");
    const db = createClient(url!, key!, { auth: { persistSession: false } });
    await expect
      .poll(async () => {
        const { data } = await db.from("pages").select("draft_data").eq("id", id).single();
        return data?.draft_data?.pageSettings?.mobileHeader;
      })
      .toBe("hidden");
    await page.reload();
    await page.getByRole("button", { name: "Page Settings", exact: true }).click();
    await expect(page.getByLabel("SEO title", { exact: true })).toHaveValue("New draft title");
    await expect(page.getByLabel("Background color", { exact: true })).toHaveValue("#eeeeee");
    await page.screenshot({
      path: testInfo.outputPath("builder-page-settings.png"),
      fullPage: true,
    });
    await page.getByLabel("URL slug", { exact: true }).fill("shop");
    await page.getByRole("button", { name: "Save title and URL" }).click();
    await expect(page.getByText("That URL is reserved for a built-in site page.")).toBeVisible();
    const { data } = await db.from("pages").select("published_data,slug").eq("id", id).single();
    expect(data?.published_data?.pageSettings?.seoTitle).toBe("Settings search title");
    expect(data?.slug).toBe(slug);
  });
});
