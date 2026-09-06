import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { COMING_SOON_DESIGNS } from "../../lib/blocks/comingSoon";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const local = url && ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);

test.describe("Coming soon — all public designs", () => {
  test.skip(!local || !key, "Writes fixtures only into the isolated local Supabase stack");
  let fixtureId: string | undefined;
  let slug: string;
  test.beforeAll(async () => {
    slug = `e2e-coming-soon-${Date.now().toString(36)}`;
    const sections = COMING_SOON_DESIGNS.map(([variant]) => ({
      _key: `cs-${variant}`,
      _type: "comingSoonStudio",
      settings: {
        variant,
        ...(variant === "21"
          ? {
              afterHours: { countdown: { target: "2099-01-01T00:00:00Z" } },
              socialLinks: [
                { network: "instagram", label: "Instagram", href: "https://instagram.com" },
              ],
            }
          : {}),
        brand: "Modern Gentlemen",
        title: "Coming soon",
        intro: "A fixture description for responsive and contrast validation.",
        image: "/images/style-mono.jpg",
        imageAlt: "Tailoring",
        images: [
          { image: "/images/style-mono.jpg", alt: "Tailoring" },
          { image: "/images/watch-gear.jpg", alt: "Watch" },
          { image: "/images/film-workshop.jpg", alt: "Workshop" },
        ],
        details: [
          { title: "An editorial note", text: "A description for this note." },
          { title: "Another note", text: "A second description." },
        ],
        showSignup: true,
        signature: "The editors",
      },
    }));
    const { data, error } = await createClient(url!, key!, { auth: { persistSession: false } })
      .from("pages")
      .insert({
        title: "Coming soon test fixture",
        slug,
        status: "published",
        published_at: new Date().toISOString(),
        published_data: { sections },
        draft_data: { sections },
      })
      .select("id")
      .single();
    if (error) throw error;
    fixtureId = data.id;
  });
  test.afterAll(async () => {
    if (!fixtureId) return;
    const { error } = await createClient(url!, key!, { auth: { persistSession: false } })
      .from("pages")
      .delete()
      .eq("id", fixtureId);
    if (error) throw error;
  });
  for (const theme of ["light", "dark"]) {
    for (const width of [390, 1440]) {
      test(`${theme} at ${width}px`, async ({ page }, testInfo) => {
        test.setTimeout(120_000);
        await page.setViewportSize({ width, height: 900 });
        await page.addInitScript((value) => localStorage.setItem("mg-theme", value), theme);
        await page.goto(`/${slug}`);
        await page.evaluate(() => document.fonts.ready);
        await expect(page.locator("[data-coming-soon]")).toHaveCount(COMING_SOON_DESIGNS.length);
        for (const [id] of COMING_SOON_DESIGNS) {
          const section = page.locator(`[data-coming-soon="${id}"]`);
          await expect(section).toBeVisible();
          expect(
            await section.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
            `CS${id} overflow`
          ).toBe(true);
        }
        const refined = page.locator('[data-coming-soon="21"]');
        await expect(refined.getByRole("timer")).toBeVisible();
        await refined.getByRole("button", { name: "About", exact: true }).click();
        await expect(refined.getByRole("dialog")).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(refined.getByRole("dialog")).not.toBeVisible();
        await expect(refined.getByRole("button", { name: "About", exact: true })).toBeFocused();
        await expect(page.locator('[data-site-chrome="header"]')).toBeHidden();
        await expect(page.locator('[data-site-chrome="footer"]')).toBeHidden();
        const results = await new AxeBuilder({ page })
          .include("[data-coming-soon]")
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
          .analyze();
        expect(results.violations).toEqual([]);
        for (const id of ["01", "06", "14", "20", "21"]) {
          await testInfo.attach(`cs-${id}-${theme}-${width}`, {
            body: await page.locator(`[data-coming-soon="${id}"]`).screenshot(),
            contentType: "image/png",
          });
        }
      });
    }
  }
});
