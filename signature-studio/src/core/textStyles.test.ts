import { describe, expect, it } from "vitest";
import { applyStyle, effectiveStyle, overridesStyle, styleFromBlock } from "./textStyles";
import { block, col } from "./blocks";
import { newDoc } from "./defaults";
import { TEMPLATES } from "./templates";
import { renderSignature } from "../render/render";
import { customFontId } from "./fonts";

const doc = () => {
  const d = newDoc(TEMPLATES[0].id, TEMPLATES[0].design);
  d.details.name = "Jordan Ellis";
  d.mode = "builder";
  return d;
};

describe("text styles", () => {
  it("fill in under the block's own settings, and follow edits to the style", () => {
    const d = doc();
    d.design.textStyles = [{ id: "h", name: "Heading", font: "playfair", fontSize: 20, weight: 600, case: "upper" }];
    const st = applyStyle({ align: "center", fontSize: 12 }, "h");
    expect(st.fontSize).toBeUndefined();
    expect(effectiveStyle(st, d.design)).toMatchObject({ font: "playfair", fontSize: 20, weight: 600, align: "center" });
    expect(effectiveStyle({ ...st, weight: 300 }, d.design)?.weight).toBe(300);
    expect(overridesStyle({ ...st, weight: 300 }, d.design)).toBe(true);
    expect(overridesStyle(st, d.design)).toBe(false);
    // A custom colour on the block beats the style's colour role.
    d.design.textStyles[0].colorRole = "accent";
    expect(effectiveStyle({ ...st, color: "#123456" }, d.design)?.colorRole).toBeUndefined();
  });

  it("render through every block that uses them", () => {
    const d = doc();
    d.design.textStyles = [styleFromBlock("h", "Heading", { fontSize: 23, weight: 800 })];
    d.blocks = col([block("text", { text: "One", style: { textStyle: "h" } }), block("text", { text: "Two", style: { textStyle: "h" } })]);
    const html = renderSignature(d, { variant: "full", mode: "preview", sourceUrl: () => null }).html;
    expect(html.match(/font-weight:800/g)?.length).toBe(2);
    d.design.textStyles[0].weight = 300;
    expect(renderSignature(d, { variant: "full", mode: "preview", sourceUrl: () => null }).html.match(/font-weight:300/g)?.length).toBe(2);
  });
});

describe("brand fonts", () => {
  it("send name and text in an uploaded font as images with the words as alt text, and show real text while editing", () => {
    const d = doc();
    d.customFonts = [{ family: "Acme Sans", key: "font:x", bytes: 1 }];
    d.blocks = col([
      block("name", { style: { font: customFontId("Acme Sans") } }),
      block("text", { text: "**Bold** move", style: { font: customFontId("Acme Sans") } }),
    ]);
    const email = renderSignature(d, { variant: "full", mode: "email", resolve: () => "https://img.example.com/t.png" });
    const texts = email.images.filter((r) => r.kind === "text");
    expect(texts).toHaveLength(2);
    expect(email.html).toContain('alt="Jordan Ellis"');
    expect(email.html).toContain('alt="Bold move"');
    const preview = renderSignature(d, { variant: "full", mode: "preview", sourceUrl: () => null }).html;
    expect(preview).toContain("'Acme Sans'");
    expect(preview).toContain("Jordan Ellis</");
    // Opting out keeps it as text (inboxes show the fallback font).
    d.blocks.blocks[0].style = { font: customFontId("Acme Sans"), asImage: false };
    expect(
      renderSignature(d, { variant: "full", mode: "email", resolve: () => "https://img.example.com/t.png" }).images.filter((r) => r.kind === "text"),
    ).toHaveLength(1);
  });
});
