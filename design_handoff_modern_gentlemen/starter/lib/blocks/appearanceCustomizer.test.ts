import { describe, expect, it } from "vitest";
import {
  applyAppearanceChanges,
  appearanceTargets,
  type AppearancePayload,
} from "./appearanceCustomizer";
import { DEFAULT_MEDIA_OVERLAY } from "@/lib/domain/mediaOverlay";
import { convertStudio, studioSourceSchema } from "./studioPublishing";
const overlay = {
  ...DEFAULT_MEDIA_OVERLAY,
  mode: "linear" as const,
  color: "#c8102e",
  opacity: 63,
};
const legacy: AppearancePayload = {
  sections: [
    {
      _key: "hero",
      _type: "hero",
      settings: { title: "Keep me", image: "/photo.jpg" },
      design: { spaceBefore: "large" },
      children: [{ _key: "nested", _type: "media", settings: { src: "/film.mp4" } }],
    },
  ],
  seo: { title: "SEO" },
  pageSettings: { noIndex: true, backgroundImage: "/bg.jpg", futureField: 42 },
  customField: { retained: true },
};
function native() {
  const page = {
    page: "#ffffff",
    layoutDevice: "desktop",
    sections: [
      {
        uid: "intro",
        height: 500,
        color: "#ffffff",
        megaMenu: {
          categories: [
            { label: "Style", stories: [{ title: "A story", image: "/photo.jpg", url: "/style" }] },
          ],
        },
      },
    ],
    nodes: [
      { id: 7, kind: "media", x: 20, y: 30, w: 250, h: 150, src: "/photo.jpg", mediaType: "image" },
    ],
  };
  const source = studioSourceSchema.parse({
    version: 1,
    source: page,
    views: Object.fromEntries(
      ["desktop", "tablet", "mobile"].map((view) => [
        view,
        { ...structuredClone(page), layoutDevice: view },
      ])
    ),
  });
  return {
    sections: convertStudio(source).sections,
    _designStudio: source,
    pageSettings: { noIndex: true },
  };
}
describe("central appearance patches", () => {
  it("preserves content, SEO, unknown fields, nested identity and unrelated design", () => {
    const before = structuredClone(legacy);
    const saved = applyAppearanceChanges(legacy, {
      page: { backgroundColor: "#112233" },
      targets: [{ id: "block:hero", overlay }],
    });
    expect(legacy).toEqual(before);
    expect(saved.sections[0]).toEqual({
      ...legacy.sections[0],
      design: { spaceBefore: "large", mediaOverlay: overlay },
    });
    expect(saved.pageSettings).toEqual({
      ...(legacy.pageSettings as object),
      backgroundColor: "#112233",
    });
    expect(saved.seo).toEqual(legacy.seo);
    expect(saved.customField).toEqual(legacy.customField);
  });
  it("uses stable block identities after reorder and rejects missing targets", () => {
    const page = structuredClone(legacy);
    page.sections.unshift({ _key: "first", _type: "hero" });
    expect(
      applyAppearanceChanges(page, { targets: [{ id: "block:hero", overlay }] }).sections[1].design
        ?.mediaOverlay
    ).toEqual(overlay);
    expect(() =>
      applyAppearanceChanges(page, { targets: [{ id: "block:missing", overlay }] })
    ).toThrow("no longer exists");
  });
  it("rejects payload replacement, unsupported fields, malformed gradients and duplicate targets", () => {
    for (const changes of [
      { sections: [], targets: [] },
      { page: { noIndex: false }, targets: [] },
      { targets: [{ id: "block:hero", overlay: { ...overlay, start: 90, end: 5 } }] },
      {
        targets: [
          { id: "block:hero", overlay },
          { id: "block:hero", overlay },
        ],
      },
      { targets: [{ id: "block:hero", mega: { imageColor: true } }] },
    ])
      expect(() => applyAppearanceChanges(legacy, changes)).toThrow();
  });
  it("updates source and all responsive snapshots without changing geometry or story content", () => {
    const page = native();
    const before = structuredClone(page);
    const next = applyAppearanceChanges(page, {
      targets: [
        {
          id: "section:intro",
          mega: { imageColor: true, hoverAnimation: "border-draw", hoverColor: "#c8102e" },
        },
        { id: "stories:intro", overlay },
        { id: "media:7", overlay },
      ],
    });
    const source = studioSourceSchema.parse(next._designStudio);
    for (const doc of [source.source, ...Object.values(source.views)]) {
      expect(doc.nodes[0]).toMatchObject({ x: 20, y: 30, w: 250, h: 150, overlay });
      expect(doc.sections[0].megaMenu).toMatchObject({
        imageColor: true,
        imageOverlay: overlay,
        categories:
          before._designStudio.source.sections[0].megaMenu &&
          (before._designStudio.source.sections[0].megaMenu as { categories: unknown }).categories,
      });
    }
    expect(next.sections).toEqual(convertStudio(source).sections);
    expect(page).toEqual(before);
    expect(appearanceTargets(next).map((t) => t.id)).toEqual([
      "section:intro",
      "stories:intro",
      "media:7",
    ]);
  });
  it("does not offer shared pattern content as local appearance targets", () => {
    expect(
      appearanceTargets({ sections: [{ _key: "shared", _type: "patternRef", _ref: "pattern-id" }] })
    ).toEqual([]);
  });
});
