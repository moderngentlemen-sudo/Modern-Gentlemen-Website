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
});
