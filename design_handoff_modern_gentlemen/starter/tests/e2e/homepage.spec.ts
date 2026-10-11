import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const local = url && ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);
const email = process.env.E2E_ADMIN_EMAIL,
  password = process.env.E2E_ADMIN_PASSWORD;

test("Pages: choose a published homepage and refresh its live content", async ({
  page,
}, testInfo) => {
  test.skip(
    !local || !key || !email || !password,
    "Requires the isolated seeded CI database and editor."
  );
  const db = createClient(url!, key!, { auth: { persistSession: false } });
  const slug = `homepage-test-${Date.now()}`;
  const content = (text: string) => ({
    sections: [{ _key: "quote", _type: "pullQuote", quote: text, attribution: "HOMEPAGE TEST" }],
  });
  const original = await db.from("homepage_settings").select("page_id").single();
  if (original.error) throw original.error;
  const originalPageQuery = db.from("pages").select("id");
  const originalPage = await (
    original.data.page_id
      ? originalPageQuery.eq("id", original.data.page_id)
      : originalPageQuery.eq("slug", "home")
  ).single();
  if (originalPage.error) throw originalPage.error;
  const fixture = await db
    .from("pages")
    .insert({
      slug,
      title: "Homepage test page",
      status: "published",
      draft_data: content("Published homepage fixture"),
      published_data: content("Published homepage fixture"),
    })
    .select("id")
    .single();
  if (fixture.error) throw fixture.error;
  try {
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email!);
    await page.getByLabel("Password", { exact: true }).fill(password!);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/admin/);
    await page.goto("/admin/pages");
    const row = page
      .getByRole("row")
      .filter({ has: page.getByRole("link", { name: "Homepage test page", exact: true }) });
    await row.getByRole("button", { name: "Set as homepage", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Set homepage", exact: true })
      .click();
    await expect(row.getByText("Homepage", { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("page-settings-homepage-desktop.png") });
    const desktopViewport = page.viewportSize();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: testInfo.outputPath("page-settings-homepage-phone.png") });
    if (desktopViewport) await page.setViewportSize(desktopViewport);
    await page.goto("/");
    await expect(
      page.locator("blockquote").filter({ hasText: "Published homepage fixture" })
    ).toBeVisible();
    await page.goto(`/${slug}`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "http://localhost:3000"
    );
    await page.goto("/admin/pages");
    const originalHome = page
      .getByRole("row")
      .filter({ has: page.locator(`a[href="/admin/pages/${originalPage.data.id}"]`) });
    await originalHome.getByRole("button", { name: "Set as homepage", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Set homepage", exact: true })
      .click();
    await expect(originalHome.getByText("Homepage", { exact: true })).toBeVisible();
    await page.goto("/");
    await expect(
      page.locator("blockquote").filter({ hasText: "Published homepage fixture" })
    ).toHaveCount(0);
  } finally {
    // Restore through the real action before database cleanup, so Next's cache
    // also returns to the seeded content used by the later visual suite.
    try {
      await page.goto("/admin/pages");
      const homeRow = page
        .getByRole("row")
        .filter({ has: page.locator(`a[href="/admin/pages/${originalPage.data.id}"]`) });
      const choose = homeRow.getByRole("button", { name: "Set as homepage", exact: true });
      if (await choose.count()) {
        await choose.click();
        await page
          .getByRole("dialog")
          .getByRole("button", { name: "Set homepage", exact: true })
          .click();
        await expect(homeRow.getByText("Homepage", { exact: true })).toBeVisible();
      }
    } finally {
      const restored = await db
        .from("homepage_settings")
        .update({ page_id: original.data!.page_id })
        .eq("singleton", true);
      if (restored.error) throw restored.error;
      const cleanup = await db.from("pages").delete().eq("id", fixture.data.id);
      if (cleanup.error) throw cleanup.error;
    }
  }
});
