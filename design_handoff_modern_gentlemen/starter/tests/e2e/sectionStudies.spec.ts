import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { SECTION_STUDIES, sectionStudyType } from "../../lib/blocks/sectionStudies";
import { sectionStudyManifests } from "../../lib/blocks/manifests/sectionStudies";
import { studyPreview } from "../../components/admin/builder/studyPreview";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const local = url && ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);

test.describe("MG studies — isolated public composition", () => {
  // This test writes a fixture, never a real owner's published page.
  test.skip(!local || !key, "Requires the isolated local Supabase stack and its service key");
  let fixtureId: string | undefined;
  let slug: string;

  test.beforeAll(async () => {
    slug = `e2e-mg-studies-${Date.now().toString(36)}`;
    const sections = SECTION_STUDIES.map(([id]) => {
      const type = sectionStudyType(id);
      return {
        _key: `study-${id}`,
        _type: type,
        settings: { ...sectionStudyManifests[type].insertDefaults, ...studyPreview(type) },
      };
    });
    const { data, error } = await createClient(url!, key!, { auth: { persistSession: false } })
      .from("pages")
      .insert({
        title: "MG study test fixture",
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
      test(`${theme} at ${width}px renders every study without overflow or accessibility violations`, async ({
        page,
      }, testInfo) => {
        test.setTimeout(120_000);
        await page.setViewportSize({ width, height: 900 });
        await page.addInitScript((value) => localStorage.setItem("mg-theme", value), theme);
        await page.goto(`/${slug}`);
        await page.evaluate(() => document.fonts.ready);
        await expect(page.locator("[data-mg-study]")).toHaveCount(36);
        for (const [id] of SECTION_STUDIES) {
          const section = page.locator(`[data-mg-study="${id}"]`);
          await expect(section).toBeVisible();
          expect(
            await section.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)
          ).toBe(true);
        }
        const results = await new AxeBuilder({ page })
          .include("[data-mg-study]")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze();
        expect(results.violations).toEqual([]);
        // Attach review evidence rather than automatically accepting new visual baselines.
        for (const id of ["01", "13", "25", "31", "35"]) {
          await testInfo.attach(`mg-study-${id}-${theme}-${width}`, {
            body: await page.locator(`[data-mg-study="${id}"]`).screenshot(),
            contentType: "image/png",
          });
        }
      });
    }
  }
});
