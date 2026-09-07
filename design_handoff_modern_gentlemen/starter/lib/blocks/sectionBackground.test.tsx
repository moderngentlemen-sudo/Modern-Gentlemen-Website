import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BlockDesignFrame } from "@/components/BlockDesignFrame";
import { NativeForm } from "@/components/elements/NativeForm";
import { readSectionBackground, sectionBackgroundSchema } from "../domain/sectionBackground";
import { collectMediaReferences } from "./media";
import { validateBlock } from "./validate";
import { normalizeBlock } from "./normalize";
describe("section media backgrounds", () => {
  it("rejects unsafe media and page-level chrome settings", () => {
    for (const background of [
      { backgroundImage: "https://user:password@example.com/a.jpg" },
      { backgroundVideo: "//example.com/a.mp4" },
      { backgroundImage: "/\\example.com/a" },
      { header: "hidden" },
      { focalX: 101 },
    ]) {
      expect(sectionBackgroundSchema.safeParse(background).success).toBe(false);
      expect(
        validateBlock({
          _key: "text",
          _type: "nativeText",
          settings: { content: "Text" },
          design: { background },
        }).ok
      ).toBe(false);
    }
  });
  it("retains valid media usage when another draft field is temporarily invalid", () => {
    const background = { backgroundImage: "/image.jpg", backgroundColor: "incomplete" };
    expect(readSectionBackground(background)).toEqual({ backgroundImage: "/image.jpg" });
    expect(
      collectMediaReferences([
        {
          _key: "text",
          _type: "nativeText",
          settings: { content: "Text" },
          design: { background },
        },
      ])
    ).toMatchObject([
      {
        key: "text",
        fieldPath: "design.background.backgroundImage",
        kind: "image",
        url: "/image.jpg",
      },
    ]);
  });
  it("tracks nested section images and videos", () => {
    const references = collectMediaReferences([
      {
        _key: "parent",
        _type: "columns",
        children: [
          {
            _key: "child",
            _type: "nativeText",
            settings: { content: "Text" },
            design: {
              background: { backgroundImage: "/poster.jpg", backgroundVideo: "/film.mp4" },
            },
          },
        ],
      },
    ]);
    expect(references.map((r) => [r.key, r.kind, r.url])).toEqual([
      ["child", "image", "/poster.jpg"],
      ["child", "video", "/film.mp4"],
    ]);
  });
  it("keeps original markup and adds only opted-in background media", () => {
    expect(
      renderToStaticMarkup(
        <BlockDesignFrame>
          <p>Original</p>
        </BlockDesignFrame>
      )
    ).toBe("<p>Original</p>");
    const html = renderToStaticMarkup(
      <BlockDesignFrame
        design={{ background: { backgroundImage: "/image.jpg", focalX: 20, focalY: 80 } }}
      >
        <p>Original</p>
      </BlockDesignFrame>
    );
    expect(html).toContain("background-position:20% 80%");
    expect(html).toContain("<p>Original</p>");
    expect(html).not.toContain("data-page-header=");
  });
  it("persists independent form text roles without changing field semantics", () => {
    const settings = {
      formKey: "contact",
      fields: [{ name: "email", label: "Email", type: "email" as const }],
      typography: { labels: { fontSize: 18 }, inputs: { fontSize: 20 }, button: { fontSize: 22 } },
    };
    expect(normalizeBlock({ _key: "form", _type: "nativeForm", settings })).toMatchObject(settings);
    const html = renderToStaticMarkup(<NativeForm {...settings} />);
    expect(html).toContain("font-size:18px");
    expect(html).toContain("font-size:20px");
    expect(html).toContain("font-size:22px");
    expect(html).toContain('type="email"');
  });
});
