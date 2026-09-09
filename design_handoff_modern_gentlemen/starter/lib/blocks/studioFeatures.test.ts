import { describe, expect, it } from "vitest";
import { convertStudio } from "./studioPublishing";
import { normalizeStudioMegaMenu, normalizeStudioVideo } from "./studioFeatures";
import { studioDestination } from "./studioValues";
import { groupStudioIssues } from "./studioIssues";

function studioFixture() {
  const page = {
    page: "#f8f7f3",
    layoutDevice: "desktop",
    sections: [{ uid: "intro", height: 480, color: "#f8f7f3" }],
    nodes: [1, 2, 3].map((id) => ({ id, kind: "text", x: 24, y: 40 * id, w: 300, h: 40 })),
  };
  return {
    version: 1,
    source: structuredClone(page),
    views: Object.fromEntries(
      ["desktop", "tablet", "mobile"].map((view) => [
        view,
        { ...structuredClone(page), layoutDevice: view },
      ])
    ),
  };
}
const menu = {
  font: "Instrument Serif",
  color: "#f8f7f3",
  accent: "#c8102e",
  categories: [
    {
      label: "Style",
      stories: [
        {
          title: "A considered wardrobe",
          image: "/api/admin/design-studio?asset=editorial-tailoring.png",
          url: "",
        },
        { title: "Explore", image: "https://example.test/image.jpg", url: "/stories" },
      ],
    },
  ],
  typeStyles: { heading: { font: "DM Sans", size: 30, italic: false, color: "#432486" } },
  hoverAnimation: "underline",
  storyAnimation: "slide",
  animationDuration: 300,
};
describe("Studio video and editorial menu publishing", () => {
  it("preserves video options, posters, media appearance, menu content, fonts and animations in every view", () => {
    const input = studioFixture();
    for (const doc of Object.values(input.views)) {
      Object.assign(doc.sections[0], { megaMenu: menu });
      Object.assign(doc.nodes[0], {
        kind: "media",
        mediaType: "video",
        src: "https://example.test/movie.webm",
        poster: "https://example.test/poster.jpg",
        video: {
          autoplay: true,
          repeat: true,
          muted: true,
          controls: false,
          showToggle: true,
          preload: "auto",
        },
        cropZoom: 125,
        focalX: 40,
        focalY: 60,
        fit: "contain",
        radius: 12,
      });
    }
    const before = JSON.stringify(input),
      result = convertStudio(input);
    expect(result.issues).toEqual([]);
    for (const section of result.sections) {
      expect(section.settings?.megaMenu).toMatchObject({
        categories: [
          {
            stories: [
              { image: "/images/studio/editorial-tailoring.png", url: "" },
              { url: "/stories" },
            ],
          },
        ],
        typeStyles: { heading: { size: 30, italic: false, color: "#432486" } },
        hoverAnimation: "underline",
        storyAnimation: "slide",
        animationDuration: 300,
      });
      expect(section.children?.[0].settings).toMatchObject({
        kind: "video",
        poster: "https://example.test/poster.jpg",
        video: { autoplay: true, repeat: true, controls: false, showToggle: true, preload: "auto" },
        cropZoom: 125,
        focalX: 40,
        focalY: 60,
        fit: "contain",
        radius: 12,
      });
    }
    expect(result.sections[2].settings?.mobile).toBe(true);
    expect(JSON.stringify(input)).toBe(before);
  });
  it("uses the editor's legacy loop and playback defaults without enabling autoplay", () => {
    expect(normalizeStudioVideo(undefined, true)).toMatchObject({
      success: true,
      data: {
        autoplay: false,
        repeat: true,
        muted: true,
        controls: true,
        showToggle: true,
        preload: "metadata",
      },
    });
    expect(normalizeStudioVideo({ controls: "yes" }, false).success).toBe(false);
  });
  it("allows optional unlinked story cards but rejects unsafe links, private images and malformed styles", () => {
    expect(normalizeStudioMegaMenu(menu).issues).toEqual([]);
    for (const changed of [
      {
        ...menu,
        categories: [
          { label: "Style", stories: [{ title: "Unsafe", url: "javascript:alert(1)" }] },
        ],
      },
      {
        ...menu,
        categories: [
          { label: "Style", stories: [{ title: "Private", image: "/api/admin/media" }] },
        ],
      },
      { ...menu, typeStyles: { heading: { font: "Unknown font" } } },
      { ...menu, typeStyles: { heading: { size: 5000 } } },
      { ...menu, color: "url(https://example.test)" },
      { ...menu, animationDuration: -1 },
    ])
      expect(normalizeStudioMegaMenu(changed).issues.length).toBeGreaterThan(0);
  });
  it("keeps missing button destinations blocked and groups repeated checks without combining different buttons", () => {
    const input = studioFixture();
    for (const doc of Object.values(input.views))
      Object.assign(doc.nodes[2], {
        kind: "button",
        name: "Browse stories",
        action: { type: "none" },
      });
    const issues = convertStudio(input).issues;
    expect(issues).toHaveLength(3);
    expect(groupStudioIssues(issues)).toEqual([
      expect.objectContaining({
        nodeId: 3,
        sectionIndex: 0,
        views: ["desktop", "tablet", "mobile"],
        message: expect.stringContaining("Browse stories"),
      }),
    ]);
    expect(
      groupStudioIssues([...issues, { ...issues[0], path: "desktop.sections.0.nodes.4" }])
    ).toHaveLength(2);
  });
  it.each([
    "/stories",
    "https://example.test/",
    "http://example.test/",
    "mailto:editor@example.test",
    "tel:+441234567",
    "#stories",
  ])("accepts an explicit destination: %s", (url) => {
    expect(studioDestination(url)).toBe(url);
  });
  it.each([
    "javascript:alert(1)",
    "data:text/html,test",
    "//example.test",
    "/admin",
    "/api/test",
    "/safe/../admin/",
    "/%61dmin/test",
    "https://user:pass@example.test/",
    "https://",
    "https://example.test\\bad",
    "https://example.test/\n",
  ])("rejects unsafe destination: %s", (url) => {
    expect(studioDestination(url)).toBeUndefined();
  });
});

describe("Studio media appearance publishing", () => {
  const overlay = {
    mode: "linear",
    color: "#c8102e",
    endColor: "#00000000",
    opacity: 35,
    angle: 180,
    start: 10,
    end: 90,
    x: 50,
    y: 50,
  };
  it("round-trips section backgrounds, image overlays, color photos and category effects in every layout", () => {
    const input = studioFixture();
    for (const doc of Object.values(input.views)) {
      Object.assign(doc.sections[0], {
        backgroundMedia: { src: "/images/hero-cover.jpg", type: "image", focalX: 25, focalY: 75 },
        overlay,
        megaMenu: {
          ...menu,
          hoverAnimation: "highlight-sweep",
          hoverColor: "#ccaa77",
          imageColor: true,
          imageOverlay: overlay,
        },
      });
      Object.assign(doc.nodes[0], {
        kind: "media",
        mediaType: "video",
        src: "https://example.test/film.mp4",
        overlay,
      });
    }
    const original = JSON.stringify(input),
      result = convertStudio(input);
    expect(result.issues).toEqual([]);
    expect(JSON.stringify(input)).toBe(original);
    for (const section of result.sections) {
      expect(section.settings).toMatchObject({
        backgroundSrc: "/images/hero-cover.jpg",
        backgroundType: "image",
        focalX: 25,
        overlay,
        megaMenu: {
          hoverAnimation: "highlight-sweep",
          hoverColor: "#ccaa77",
          imageColor: true,
          imageOverlay: overlay,
        },
      });
      expect(section.children?.[0].settings).toMatchObject({ kind: "video", overlay });
    }
  });
  it("blocks malformed overlays and local background URLs before publishing", () => {
    const input = studioFixture();
    Object.assign(input.views.desktop.sections[0], {
      backgroundMedia: { type: "image", src: "blob:local" },
      overlay: { ...overlay, start: 95, end: 20 },
    });
    const result = convertStudio(input);
    expect(result.issues.some((i) => i.message.includes("permanent section background"))).toBe(
      true
    );
    expect(result.issues.some((i) => i.message.includes("overlay"))).toBe(true);
  });
});
