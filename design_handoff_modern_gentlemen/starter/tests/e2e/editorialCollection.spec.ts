import { expect, test, type Page } from "@playwright/test";
import type { Json } from "../../lib/db/database.types";
import { createClient } from "@supabase/supabase-js";
import AxeBuilder from "@axe-core/playwright";
import { SEARCH_LAYOUT_PRESETS, SEARCH_MOTION_PRESETS } from "../../lib/domain/searchPresets";
import { ARTICLE_DESIGN_PRESETS } from "../../lib/domain/articleDesign";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.E2E_ADMIN_EMAIL,
  password = process.env.E2E_ADMIN_PASSWORD;
const local = url && ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);
async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email!);
  await page.getByLabel("Password", { exact: true }).fill(password!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin/);
}
test.describe("Editorial collection", () => {
  test.skip(
    !local || !key || !email || !password,
    "Requires the isolated seeded CI database and editor."
  );
  let articleId: string, slug: string;
  let originalTheme: { id: string; draft_data: Json; published_data: Json | null } | null = null;
  let themePublished = false;
  test.beforeEach(async () => {
    originalTheme = null;
    themePublished = false;
    slug = `e2e-editorial-collection-${Date.now().toString(36)}`;
    const payload = {
      hero: {
        featuredMedia: {
          kind: "gallery",
          cover: { url: "/images/film-workshop.jpg", kind: "image", alt: "The workshop" },
          gallery: [
            { url: "/images/film-workshop.jpg", kind: "image", alt: "The workshop" },
            { url: "/images/film-watchmaker.jpg", kind: "image", alt: "Details" },
          ],
        },
      },
      sections: [
        {
          _key: "chapter",
          _type: "nativeHeading",
          settings: { text: "A considered approach", level: "h2" },
        },
        {
          _key: "body",
          _type: "nativeText",
          settings: {
            content:
              "An authored article body connects the new presentation to the existing publishing system. Its content remains editable in both builders.",
          },
        },
      ],
    };
    const db = createClient(url!, key!, { auth: { persistSession: false } });
    const row = await db
      .from("articles")
      .insert({
        slug,
        title: "Collection review article",
        subtitle: "A real article fixture for the new editorial collection.",
        reading_minutes: 6,
        status: "published",
        published_at: new Date().toISOString(),
        draft_data: payload,
        published_data: payload,
      })
      .select("id")
      .single();
    if (row.error) throw row.error;
    articleId = row.data.id;
  });
  test.afterEach(async ({ page }) => {
    if (originalTheme) {
      const db = createClient(url!, key!, { auth: { persistSession: false } });
      const restored = await db
        .from("theme_settings")
        .update({
          draft_data: themePublished ? originalTheme.published_data : originalTheme.draft_data,
        })
        .eq("id", originalTheme.id);
      if (restored.error) throw restored.error;
      if (themePublished) {
        await page.goto("/admin/theme");
        await page.getByRole("button", { name: "Publish", exact: true }).click();
        await expect(page.getByText("Theme published", { exact: true })).toBeVisible();
        const draft = await db
          .from("theme_settings")
          .update({ draft_data: originalTheme.draft_data })
          .eq("id", originalTheme.id);
        if (draft.error) throw draft.error;
      }
    }

    if (articleId) {
      const result = await createClient(url!, key!, { auth: { persistSession: false } })
        .from("articles")
        .delete()
        .eq("id", articleId);
      if (result.error) throw result.error;
    }
  });
  test("previews all search layouts, both color modes, and all paired animations", async ({
    page,
  }, info) => {
    test.setTimeout(240000);
    await page.setViewportSize({ width: 1600, height: 1100 });
    await signIn(page);
    await page.goto("/admin/customizer");
    const preview = page.frameLocator('iframe[title="Live appearance preview"]');
    await expect(preview.locator("header").first()).toBeVisible();
    const theme = await createClient(url!, key!, { auth: { persistSession: false } })
      .from("theme_settings")
      .select("id,draft_data,published_data")
      .eq("key", "default")
      .single();
    if (theme.error) throw theme.error;
    originalTheme = theme.data;
    await page.getByLabel("Opening & closing animation").selectOption("none");
    for (const layout of SEARCH_LAYOUT_PRESETS) {
      await page.getByLabel("Search layout", { exact: true }).selectOption(layout.id);
      const root = preview.locator(`[data-search-layout="${layout.id}"]`);
      await expect(root).toBeVisible();
      await expect(root.getByRole("searchbox")).toHaveValue("Watches");
      await expect(root.locator("[data-search-row]").first()).toBeAttached();
      const row = root.locator("button[data-search-row]").first();
      if (await row.count())
        await expect(root.locator("section[data-search-preview]").first()).toBeVisible();
      const sheet = await root.locator("[data-search-sheet]").evaluate((el) => ({
        width: el.getBoundingClientRect().width,
        height: el.getBoundingClientRect().height,
        viewportWidth: document.documentElement.clientWidth,
        viewportHeight: window.innerHeight,
      }));
      if (layout.id === "compact-overlay") expect(sheet.width).toBeLessThanOrEqual(680);
      if (layout.id === "side-drawer") expect(sheet.width).toBeLessThanOrEqual(480);
      if (layout.fullscreen) {
        expect(sheet.width).toBeCloseTo(sheet.viewportWidth, 0);
        expect(sheet.height).toBeCloseTo(sheet.viewportHeight, 0);
      }
      await page.screenshot({ path: info.outputPath(`search-${layout.id}.png`) });
      await root.getByRole("button", { name: /Switch search to/ }).click();
      await expect(root).toHaveAttribute("data-appearance", "dark");
      await root.getByRole("button", { name: "Close search", exact: true }).click();
      await expect(root).toHaveCount(0);
    }
    await page.getByLabel("Search layout", { exact: true }).selectOption("preview-on-demand");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    for (const motion of SEARCH_MOTION_PRESETS) {
      await page.getByLabel("Opening & closing animation").selectOption(motion.id);
      const root = preview.locator(`[data-search-motion="${motion.id}"]`);
      await expect(root).toBeVisible();
      await expect
        .poll(() => root.evaluate((el) => el.getAnimations({ subtree: true }).length))
        .toBeGreaterThan(0);
      await root.getByRole("searchbox").press("Escape");
      await expect(root).toHaveCount(0);
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.getByLabel("Viewport", { exact: true }).selectOption("390");
    await page.getByRole("button", { name: "Preview search & animation" }).click();
    const search = preview.locator('[data-search-layout="preview-on-demand"]');
    await search.getByRole("searchbox").fill("watches");
    await expect(search.locator("[data-search-row]").first()).toBeVisible();
    await search.locator("button[data-search-row]").first().click();
    await expect(search.locator("[data-search-preview]")).toBeInViewport();
    await page.screenshot({ path: info.outputPath("search-mobile.png") });
    await expect
      .poll(() =>
        preview
          .locator("body")
          .evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
      )
      .toBe(true);
    await search.getByRole("button", { name: "Close search", exact: true }).click();
    await page.getByRole("button", { name: "Save theme draft", exact: true }).click();
    await expect(
      page.getByText("Site theme draft saved. Publish when you are ready.", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save theme draft", exact: true })
    ).toBeDisabled();
    await page.reload();
    await expect(page.getByLabel("Search layout", { exact: true })).toHaveValue(
      "preview-on-demand"
    );
    const previewPageId = await page.getByLabel("Preview page", { exact: true }).inputValue();
    await page.getByRole("button", { name: "Review & publish", exact: true }).click();
    themePublished = true;
    await Promise.all([
      page.waitForURL(
        (url) =>
          url.pathname === "/admin/customizer" && url.searchParams.get("id") === previewPageId,
        { waitUntil: "load" }
      ),
      page.getByRole("button", { name: "Publish site theme", exact: true }).click(),
    ]);
    await expect(page.getByLabel("Search layout", { exact: true })).toHaveValue(
      "preview-on-demand"
    );
    await page.goto("/");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.locator('[data-search-layout="preview-on-demand"]')).toBeVisible();
    const violations = (
      await new AxeBuilder({ page })
        .include("[data-search-layout]")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations;
    expect(violations).toEqual([]);
  });
  test("previews all 29 article designs and saves a per-article override through the editor", async ({
    page,
  }, info) => {
    test.setTimeout(240000);
    await page.setViewportSize({ width: 1600, height: 1100 });
    await signIn(page);
    await page.goto("/admin/customizer");
    await page.getByRole("button", { name: /^Articles Designs/ }).click();
    await page.getByLabel("Article to preview", { exact: true }).selectOption(slug);
    const preview = page.frameLocator('iframe[title="Live appearance preview"]');
    for (const preset of ARTICLE_DESIGN_PRESETS) {
      await page.getByLabel("Default article design", { exact: true }).selectOption(preset.id);
      const article = preview.locator(`[data-article-design="${preset.id}"]`);
      await expect(article).toBeVisible();
      await expect(article.getByRole("heading", { level: 1 })).toHaveText(
        "Collection review article"
      );
      await expect(
        article.getByText("A considered approach", { exact: true }).first()
      ).toBeAttached();
      await page.screenshot({ path: info.outputPath(`article-${preset.id}.png`) });
      const heading = article.getByRole("heading", { level: 1 });
      expect(
        await heading.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
      ).toBeGreaterThan(30);
      expect(await article.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    }
    for (const { id: preset } of ARTICLE_DESIGN_PRESETS) {
      await page.getByLabel("Viewport", { exact: true }).selectOption("390");
      await page.getByLabel("Default article design", { exact: true }).selectOption(preset);
      await expect(preview.locator(`[data-article-design="${preset}"]`)).toBeVisible();
      const title = preview.locator(`[data-article-design="${preset}"] h1`);
      expect(await title.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      await page.screenshot({ path: info.outputPath(`article-${preset}-mobile.png`) });
      expect(
        await preview
          .locator("body")
          .evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
      ).toBe(true);
    }
    page.on("dialog", (dialog) => dialog.accept());
    await page.goto(`/admin/articles/${articleId}`);
    await page.getByLabel("Article design", { exact: true }).selectOption("immersive");
    await page.getByLabel("Body type · px", { exact: true }).fill("20");
    // A provider link pasted into Video URL must never reach the native video element.
    await page.getByLabel("Media type", { exact: true }).selectOption("video");
    await page
      .getByLabel("Video URL", { exact: true })
      .fill("https://www.youtube.com/watch?v=QXZ6znSpEh0&pp=search");
    const mediaPreview = page.getByLabel("Article presentation preview");
    await expect(mediaPreview.locator("video")).toHaveCount(0);
    await expect(mediaPreview.getByRole("button", { name: /Play on YouTube/ })).toBeVisible();
    await page.getByRole("button", { name: "Save details", exact: true }).click();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Article design", { exact: true })).toHaveValue("immersive");
    await expect(page.getByLabel("Body type · px", { exact: true })).toHaveValue("20");
    await expect(page.getByLabel("Video URL", { exact: true })).toHaveValue(
      "https://www.youtube.com/watch?v=QXZ6znSpEh0&pp=search"
    );
    const db = createClient(url!, key!, { auth: { persistSession: false } });
    const saved = await db.from("articles").select("draft_data").eq("id", articleId).single();
    if (saved.error) throw saved.error;
    expect(saved.data.draft_data.hero.presentation.design).toMatchObject({
      preset: "immersive",
      bodySize: 20,
    });
    expect(saved.data.draft_data.sections).toHaveLength(2);
    await page.getByRole("link", { name: "Compose sections", exact: true }).click();
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText(/Published v\d+/)).toBeVisible();
    await page.goto(`/article/${slug}`);
    const article = page.locator('[data-article-design="immersive"]');
    await expect(article).toBeVisible();
    await expect(article.locator("video")).toHaveCount(0);
    await expect(article.getByText("A considered approach", { exact: true }).first()).toBeVisible();
    const body = article.locator("[data-rich-text] p").first();
    await expect(body).toHaveCSS("font-size", "20px");
    await article.getByRole("button", { name: "Larger type" }).click();
    await expect(body).toHaveCSS("font-size", "22px");
    await article.getByRole("button", { name: "Regular type" }).click();
    await article.getByRole("button", { name: /Play on YouTube/ }).click();
    await expect(article.locator("iframe")).toHaveAttribute(
      "src",
      /youtube-nocookie\.com\/embed\/QXZ6znSpEh0/
    );
    await article.getByRole("button", { name: /Close player/ }).click();
    await expect(article.locator("iframe")).toHaveCount(0);

    // The opt-in autoplay experience publishes through the same saved article design.
    await page.goto(`/admin/articles/${articleId}`);
    await page.getByText("Video playback", { exact: true }).click();
    await page.getByRole("switch", { name: "Autoplay YouTube silently", exact: true }).click();
    await page.getByRole("button", { name: "Save details", exact: true }).click();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    await page.reload();
    await page.getByText("Video playback", { exact: true }).click();
    await expect(
      page.getByRole("switch", { name: "Autoplay YouTube silently", exact: true })
    ).toHaveAttribute("aria-checked", "true");
    await page.getByRole("link", { name: "Compose sections", exact: true }).click();
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText(/Published v\d+/)).toBeVisible();
    await page.goto(`/article/${slug}`);
    await expect(article).toHaveAttribute("data-inline-youtube", "true");
    // The suite defaults to reduced motion: no autoplay iframe should load in that mode.
    await expect(article.getByRole("button", { name: "Play YouTube video" })).toBeVisible();
    await expect(article.locator("iframe")).toHaveCount(0);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(article.locator("iframe")).toHaveAttribute(
      "src",
      /youtube-nocookie\.com\/embed\/QXZ6znSpEh0/
    );
    await expect(article.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(article.getByRole("button", { name: /Close player/ })).toHaveCount(0);
    const mediaBottom = await article
      .locator("iframe")
      .evaluate((el) => el.getBoundingClientRect().bottom);
    const titleTop = await article.locator("h1").evaluate((el) => el.getBoundingClientRect().top);
    expect(titleTop).toBeGreaterThanOrEqual(mediaBottom);
    await page.screenshot({
      path: info.outputPath("article-public-integrated.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(article.getByRole("heading", { level: 1 })).toBeVisible();
    const mobilePlayer = await article.locator("iframe").boundingBox();
    expect(mobilePlayer?.width).toBeGreaterThanOrEqual(200);
    expect(mobilePlayer?.height).toBeGreaterThanOrEqual(200);
    expect(await article.evaluate((el) => el.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({
      path: info.outputPath("article-youtube-autoplay-mobile.png"),
      fullPage: true,
    });
    const violations = (
      await new AxeBuilder({ page })
        .include("[data-article-design]")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations;
    expect(violations).toEqual([]);
  });
});
