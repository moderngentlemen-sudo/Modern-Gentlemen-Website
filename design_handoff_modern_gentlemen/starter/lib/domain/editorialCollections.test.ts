import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ARTICLE_DESIGN_PRESETS, articleDesignSchema, resolveArticleDesign } from "./articleDesign";
import {
  SEARCH_LAYOUT_PRESETS,
  SEARCH_MOTION_PRESETS,
  DEFAULT_SEARCH_APPEARANCE,
} from "./searchPresets";
import { DEFAULT_THEME_SETTINGS, parseThemeSettings, themeSettingsSchema } from "./theme";
import {
  articlePresentationOf,
  withArticlePresentation,
  withArticleFeaturedMedia,
} from "./articles";
describe("approved editorial collections", () => {
  it("keeps the previous live defaults and independent builder selections intact", () => {
    expect(parseThemeSettings({})).toEqual(DEFAULT_THEME_SETTINGS);
    const payload = {
      hero: { custom: "keep" },
      sections: [{ _key: "body", _type: "nativeParagraph" }],
      templateId: "assigned",
    };
    const changed = withArticlePresentation(
      withArticleFeaturedMedia(payload, {
        kind: "embed",
        embedUrl: "https://youtu.be/aqz-KE-bpKQ",
      }),
      { headerMode: "template", appearance: "template", design: { preset: "immersive" } }
    );
    expect(changed.sections).toEqual(payload.sections);
    expect(changed.templateId).toBe("assigned");
    expect(changed.hero).toMatchObject({
      custom: "keep",
      featuredMedia: { kind: "embed" },
      presentation: { design: { preset: "immersive" } },
    });
    expect(articlePresentationOf(changed).design?.preset).toBe("immersive");
  });
  it("persists every search layout and animation through the published theme parser", () => {
    expect(SEARCH_LAYOUT_PRESETS).toHaveLength(27);
    expect(SEARCH_MOTION_PRESETS).toHaveLength(30);
    expect(SEARCH_LAYOUT_PRESETS.filter((p) => p.fullscreen)).toHaveLength(5);
    for (const layout of SEARCH_LAYOUT_PRESETS)
      for (const motion of SEARCH_MOTION_PRESETS) {
        const settings = {
          ...DEFAULT_THEME_SETTINGS,
          header: {
            ...DEFAULT_THEME_SETTINGS.header,
            search: { ...DEFAULT_SEARCH_APPEARANCE, layout: layout.id, motion: motion.id },
          },
        };
        expect(parseThemeSettings(themeSettingsSchema.parse(settings)).header.search).toEqual(
          settings.header.search
        );
      }
  });
  it("preserves all 29 article presets and inheritance while rejecting unsupported settings", () => {
    expect(ARTICLE_DESIGN_PRESETS).toHaveLength(29);
    const css = readFileSync("components/article/EditorialArticle.module.css", "utf8");
    for (const preset of ARTICLE_DESIGN_PRESETS) {
      const settings = { ...DEFAULT_THEME_SETTINGS, articles: { preset: preset.id } };
      expect(parseThemeSettings(themeSettingsSchema.parse(settings)).articles).toEqual(
        settings.articles
      );
      expect(css).toContain(`.v${preset.layout.slice(1)}`);
    }
    expect(
      resolveArticleDesign(
        { preset: "horizon", bodyWidth: 700 },
        { preset: "inherit", bodySize: 20 }
      )
    ).toEqual({ preset: "horizon", bodyWidth: 700, bodySize: 20 });
    expect(
      resolveArticleDesign(
        { preset: "horizon", heroHeight: 600 },
        { preset: "inherit", heroHeight: undefined }
      ).heroHeight
    ).toBe(600);
    expect(resolveArticleDesign({ preset: "horizon" }, { preset: "legacy" }).preset).toBe("legacy");
    for (const bad of [
      { preset: "unknown" },
      { preset: "immersive", bodySize: 200 },
      { preset: "immersive", titleColor: "url(x)" },
      { preset: "immersive", overlay: { mode: "solid", opacity: 900 } },
    ])
      expect(articleDesignSchema.safeParse(bad).success).toBe(false);
  });
});
