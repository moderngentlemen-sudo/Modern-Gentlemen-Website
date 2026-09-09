import { describe, expect, it } from "vitest";
import { convertStudio, studioSourceSchema, studioColor, studioGradient } from "./studioPublishing";
import { validateDocumentPayload } from "@/lib/services/documents";
import type { Json } from "@/lib/db/database.types";

export function studioFixture() {
  const page = {
    title: "Invitation",
    page: "#f8f7f3",
    layoutDevice: "desktop",
    sections: [{ uid: "intro", height: 480, color: "#f8f7f3", stops: ["#f8f7f3", "#ffffff"] }],
    nodes: [
      {
        id: 1,
        kind: "text",
        x: 24,
        y: 40,
        w: 300,
        h: 80,
        text: "A considered life.",
        size: 40,
        color: "#141414",
        font: "Instrument Serif",
      },
      { id: 2, kind: "divider", x: 24, y: 140, w: 300, h: 10, thickness: 0.25, color: "#14141480" },
      {
        id: 3,
        kind: "button",
        x: 24,
        y: 180,
        w: 200,
        h: 50,
        text: "Read more",
        action: { type: "section", sectionId: "intro" },
        color: "#ffffff",
        fill: "#141414",
      },
    ],
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
describe("Studio publishing conversion", () => {
  it("uses each section's saved coordinate width and still converts historical drafts", () => {
    const input = studioFixture();
    expect(convertStudio(input).sections[0].settings?.width).toBe(760);
    const canvasWidths = { desktop: 1416, tablet: 834, mobile: 390 };
    for (const page of [input.source, ...Object.values(input.views)]) {
      Object.assign(page.sections[0], { canvasWidths });
    }
    const before = JSON.stringify(input);
    const converted = convertStudio(input);
    expect(converted.issues).toEqual([]);
    for (const [index, width] of Object.values(canvasWidths).entries()) {
      expect(converted.sections[index].settings?.width).toBe(width);
      expect(converted.sections[index].children?.[0].settings?.canvasWidth).toBe(width);
      expect(converted.sections[index].children?.[0].settings?.size).toBe(40);
      expect(converted.sections[index].settings?.height).toBe(480);
    }
    expect(JSON.stringify(input)).toBe(before);
    Object.assign(input.source.sections[0], { canvasWidths: { ...canvasWidths, desktop: 0 } });
    expect(studioSourceSchema.safeParse(input).success).toBe(false);
  });
  it.each([
    ["http://127.0.0.1:54321/storage/v1/object/public/media/test.png", true],
    ["http://localhost:54321/storage/v1/object/public/media/test.png", true],
    ["https://example.test/storage/v1/object/public/media/test.png", true],
    ["http://localhost.example.test/test.png", false],
    ["http://example.test/test.png", false],
    ["data:image/png;base64,YQ==", false],
  ])("validates hosted image URL %s", (src, accepted) => {
    const input = studioFixture();
    for (const page of [input.source, ...Object.values(input.views)]) {
      Object.assign(page.nodes[0], { kind: "media", mediaType: "image", src });
    }
    expect(
      convertStudio(input).issues.some((issue) => issue.message.includes("permanent image URL"))
    ).toBe(!accepted);
  });
  it("accepts timestamp element IDs produced by Add and Duplicate without changing them", () => {
    const input = studioFixture();
    const id = 1788900000000;
    input.source.nodes[0].id = id;
    for (const page of Object.values(input.views)) page.nodes[0].id = id;
    const parsed = studioSourceSchema.safeParse(input);
    expect(parsed.success).toBe(true);
    expect(convertStudio(input).issues).toEqual([]);
    expect(convertStudio(input).sections[0].children?.[0]._key).toContain(String(id));
  });
  it("keeps geometry bounded independently of element IDs", () => {
    const input = studioFixture();
    input.source.nodes[0].x = 100001;
    expect(studioSourceSchema.safeParse(input).success).toBe(false);
    for (const id of [NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, -1, 1.5]) {
      const invalid = studioFixture();
      invalid.source.nodes[0].id = id;
      expect(studioSourceSchema.safeParse(invalid).success).toBe(false);
    }
  });
  it("preserves responsive geometry and subpixel divider settings in real registered blocks", () => {
    const result = convertStudio(studioFixture());
    expect(result.issues).toEqual([]);
    expect(result.sections).toHaveLength(3);
    expect(result.sections[2].visibility?.devices).toEqual(["mobile"]);
    expect(result.sections[0].children?.[1].settings?.thickness).toBe(0.25);
    expect(result.sections[2].children?.[2].settings?.href).toBe("#studio-intro-mobile");
  });
  it("rejects unrelated workspace pages rather than placing private drafts in published data", () => {
    const input = studioFixture();
    Object.assign(input.source, { workspace: { pages: [{ title: "Private draft" }] } });
    expect(studioSourceSchema.safeParse(input).success).toBe(false);
  });
  it("reports unsupported content instead of silently approving an incomplete page", () => {
    const input = studioFixture();
    Object.assign(input.views.desktop.sections[0], { megaMenu: { categories: [] } });
    Object.assign(input.views.mobile.nodes[0], { richHtml: "<p>Formatted</p>" });
    input.views.tablet.nodes[0].kind = "signup";
    expect(
      convertStudio(input)
        .issues.map((i) => i.message)
        .join(" ")
    ).toMatch(/Mega menu.*Formatted text|Mega menu/s);
    expect(convertStudio(input).issues).toHaveLength(3);
  });
  it("refuses temporary assets and executable link schemes", () => {
    const input = studioFixture();
    Object.assign(input.views.desktop.nodes[0], { kind: "media", src: "blob:private" });
    input.views.desktop.nodes[2].action = { type: "url", url: "javascript:alert(1)" } as never;
    expect(convertStudio(input).issues).toHaveLength(2);
  });
  it("blocks publication when a generated tree no longer matches its Studio source", () => {
    const input = studioFixture(),
      result = convertStudio(input);
    const payload = { sections: result.sections, _designStudio: input } as unknown as Json;
    expect(validateDocumentPayload("page", payload).ok).toBe(true);
    result.sections[0].children![0].settings!.text = "Changed outside Studio";
    expect(validateDocumentPayload("page", payload).ok).toBe(false);
  });
  it("accepts unchanged content after JSONB reorders object keys, while preserving array order", () => {
    const source = studioFixture();
    const converted = convertStudio(source);
    function reordered(value: unknown): unknown {
      if (Array.isArray(value)) return value.map(reordered);
      if (value && typeof value === "object")
        return Object.fromEntries(
          Object.entries(value)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, entry]) => [key, reordered(entry)])
        );
      return value;
    }
    const stored = reordered({ sections: converted.sections, _designStudio: source }) as Json;
    expect(validateDocumentPayload("page", stored).issues).toEqual([]);
    const tree = (stored as { sections: typeof converted.sections }).sections;
    tree[0].children!.reverse();
    expect(validateDocumentPayload("page", stored).ok).toBe(false);
  });
  it("does not mutate the source or accept unsafe colors/gradients", () => {
    const input = studioFixture(),
      before = JSON.stringify(input);
    convertStudio(input);
    expect(JSON.stringify(input)).toBe(before);
    expect(studioColor("url(https://example.com)")).toBeUndefined();
    expect(
      studioGradient("linear-gradient(0deg,#fff,#000),url(https://example.com)")
    ).toBeUndefined();
  });
  it("publishes all three launch widgets across independent responsive layouts", () => {
    const input = studioFixture();
    for (const [view, doc] of Object.entries(input.views)) {
      const base = {
        x: view === "mobile" ? 12 : 24,
        y: 240,
        w: view === "mobile" ? 350 : 650,
        h: 80,
        font: "IBM Plex Mono",
        color: "#141414",
      };
      Object.assign(doc, {
        nodes: [
          {
            ...base,
            id: 1,
            kind: "countdown",
            widget: {
              target: "2030-01-01T00:00:00Z",
              variant: "Cards",
              unitMode: "months",
              labels: { months: "Months" },
              numberStyle: { font: "Instrument Serif", size: 32 },
              labelStyle: { size: 11, color: "#14141480" },
            },
          },
          {
            ...base,
            id: 2,
            kind: "signup",
            y: 330,
            widget: { variant: "Boxed", buttonMode: "Label", successText: "Thank you." },
          },
          {
            ...base,
            id: 3,
            kind: "social",
            y: 410,
            widget: {
              variant: "Icons",
              links: [
                {
                  label: "Instagram",
                  platform: "Instagram",
                  url: "https://instagram.com/modern.gentlemen",
                },
              ],
            },
          },
        ],
      });
    }
    const before = JSON.stringify(input),
      result = convertStudio(input);
    expect(result.issues).toEqual([]);
    expect(result.sections.flatMap((section) => section.children ?? [])).toHaveLength(9);
    expect(result.sections[2].children?.[0].settings).toMatchObject({
      kind: "countdown",
      x: 12,
      canvasWidth: 390,
      countdown: { unitMode: "months", numberStyle: { size: 32 } },
    });
    expect(
      validateDocumentPayload("page", {
        sections: result.sections,
        _designStudio: input,
      } as unknown as Json).ok
    ).toBe(true);
    expect(JSON.stringify(input)).toBe(before);
  });
  it.each([
    "",
    "javascript:alert(1)",
    "https://user:password@example.com",
    "https://example.com\\\\bad",
  ])("rejects a missing or unsafe social destination: %s", (url) => {
    const input = studioFixture();
    Object.assign(input.views.desktop.nodes[0], {
      kind: "social",
      widget: { variant: "Icons", links: [{ label: "Instagram", platform: "Instagram", url }] },
    });
    expect(convertStudio(input).issues).toEqual([
      expect.objectContaining({ message: expect.stringMatching(/Instagram/) }),
    ]);
  });
});
