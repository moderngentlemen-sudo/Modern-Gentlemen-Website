import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { convertStudio } from "../../lib/blocks/studioPublishing";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const local = url && ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);
const email = process.env.E2E_ADMIN_EMAIL,
  password = process.env.E2E_ADMIN_PASSWORD;
test.describe("Appearance Studio", () => {
  test.skip(
    !local || !key || !email || !password,
    "Requires the isolated seeded CI database and editor."
  );
  let id: string;
  test.afterEach(async () => {
    if (id) {
      const { error } = await createClient(url!, key!, { auth: { persistSession: false } })
        .from("pages")
        .delete()
        .eq("id", id);
      if (error) throw error;
    }
  });
  for (const native of [false, true])
    test(`${native ? "native" : "original"} page edits survive save, reopen and publish`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(90000);
      const source = {
        page: "#f8f7f3",
        layoutDevice: "desktop",
        sections: [
          {
            uid: "intro",
            height: 500,
            color: "#f8f7f3",
            backgroundMedia: { src: "/images/hero-cover.jpg", type: "image" },
          },
        ],
        nodes: [
          {
            id: 1,
            kind: "text",
            text: "Appearance fixture",
            x: 30,
            y: 50,
            w: 400,
            h: 80,
            size: 32,
            color: "#141414",
          },
        ],
      };
      const studio = {
        version: 1,
        source,
        views: Object.fromEntries(
          ["desktop", "tablet", "mobile"].map((view) => [
            view,
            { ...structuredClone(source), layoutDevice: view },
          ])
        ),
      };
      const payload = {
        sections: native
          ? convertStudio(studio).sections
          : [{ _key: "heading", _type: "nativeHeading", settings: { text: "Appearance fixture" } }],
        ...(native ? { _designStudio: studio } : {}),
        pageSettings: { noIndex: true, fullHeight: true },
        retained: { message: "Keep this content" },
      };
      const db = createClient(url!, key!, { auth: { persistSession: false } });
      const slug = `e2e-appearance-${native ? "native" : "original"}-${Date.now().toString(36)}`;
      const created = await db
        .from("pages")
        .insert({ title: "Appearance fixture", slug, draft_data: payload })
        .select("id")
        .single();
      if (created.error) throw created.error;
      id = created.data.id;
      await page.setViewportSize({ width: 1600, height: 1000 });
      await page.goto("/sign-in");
      await page.getByLabel("Email", { exact: true }).fill(email!);
      await page.getByLabel("Password", { exact: true }).fill(password!);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(page).toHaveURL(/\/admin/);
      if (!native) {
        await page.goto("/admin/customizer");
        await expect(
          page.frameLocator('iframe[title="Live appearance preview"]').locator("header").first()
        ).toBeVisible({ timeout: 20000 });
        await page.screenshot({
          path: testInfo.outputPath("appearance-home-desktop.png"),
          fullPage: true,
        });
        await page.getByLabel("Viewport", { exact: true }).selectOption("390");
        await page.screenshot({
          path: testInfo.outputPath("appearance-home-mobile.png"),
          fullPage: true,
        });
      }
      await page.goto(`/admin/customizer?id=${id}`);
      const preview = page.frameLocator('iframe[title="Live appearance preview"]');
      await expect(preview.getByText("Appearance fixture", { exact: true }).first()).toBeVisible({
        timeout: 20000,
      });
      await page.getByLabel("Header surface").selectOption("filled");
      await page.getByLabel("Header color", { exact: true }).fill("#123456");
      await expect(preview.locator("header").first()).toHaveAttribute(
        "style",
        /color-mix\(in srgb, (rgb\(18, 52, 86\)|#123456) 100%/
      );
      await page.getByRole("button", { name: "Compare saved", exact: true }).click();
      await expect(preview.locator("header").first()).not.toHaveAttribute(
        "style",
        /color-mix\(in srgb, (rgb\(18, 52, 86\)|#123456) 100%/
      );
      await page.getByRole("button", { name: "Show changes", exact: true }).click();
      await page.getByRole("button", { name: "Undo", exact: true }).click();
      await page.getByRole("button", { name: "Undo", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Save theme draft", exact: true })
      ).toBeDisabled();
      await page.getByRole("button", { name: "Page appearance Background & chrome" }).click();
      await page.getByLabel("Page background", { exact: true }).fill("#e8eadd");
      await page.getByRole("button", { name: "Save page draft", exact: true }).click();
      await expect(page.getByRole("status")).toContainText("Page draft saved");
      await page.reload();
      await page.getByRole("button", { name: "Page appearance Background & chrome" }).click();
      await expect(page.getByLabel("Page background", { exact: true })).toHaveValue("#e8eadd");
      await page.getByRole("button", { name: "Media overlays Color & gradients" }).click();
      await page.getByLabel("Overlay style").selectOption("linear");
      await page.getByLabel("Overlay color", { exact: true }).fill("#c8102e");
      await page.getByRole("button", { name: "Save page draft", exact: true }).click();
      await expect(page.getByRole("status")).toContainText("Page draft saved");
      await page.getByLabel("Viewport", { exact: true }).selectOption("390");
      await expect.poll(() => preview.locator("body").evaluate(() => window.innerWidth)).toBe(390);
      await page.getByLabel("Viewport", { exact: true }).selectOption("1280");
      await page.screenshot({
        path: testInfo.outputPath(`appearance-${native ? "native" : "original"}.png`),
        fullPage: true,
      });
      const saved = await db
        .from("pages")
        .select("draft_data,published_data")
        .eq("id", id)
        .single();
      expect(saved.data?.published_data).toBeNull();
      expect(saved.data?.draft_data.retained).toEqual(payload.retained);
      expect(saved.data?.draft_data.pageSettings.noIndex).toBe(true);
      if (native)
        for (const doc of [
          saved.data?.draft_data._designStudio.source,
          ...Object.values(saved.data?.draft_data._designStudio.views || {}),
        ])
          expect(
            (doc as typeof source & { sections: { overlay: { color: string } }[] }).sections[0]
              .overlay.color
          ).toBe("#c8102e");
      await page.getByRole("button", { name: "Review & publish", exact: true }).click();
      await page.getByRole("button", { name: "Publish page", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Review & publish", exact: true })
      ).toBeVisible();
      await expect
        .poll(
          async () => (await db.from("pages").select("status").eq("id", id).single()).data?.status
        )
        .toBe("published");
      const response = await page.request.get(`/${slug}`);
      expect(response.ok()).toBe(true);
      expect(await response.text()).toContain("Appearance fixture");
      await page.goto(native ? `/admin/design-studio?id=${id}` : `/admin/pages/${id}`);
      if (native)
        await expect(
          page.frameLocator('iframe[title="Modern Gentlemen Design Studio"]').locator(".mg-board")
        ).toContainText("Appearance fixture");
      else
        await expect(
          page.getByRole("button", { name: "Page Settings", exact: true })
        ).toBeVisible();
    });
});
