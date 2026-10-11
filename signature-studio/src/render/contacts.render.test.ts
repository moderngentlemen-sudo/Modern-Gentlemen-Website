import { describe, expect, it } from "vitest";
import { renderSignature } from "./render";
import { block, col } from "../core/blocks";
import { newDoc } from "../core/defaults";
import { TEMPLATES } from "../core/templates";
import { scaleDoc } from "../core/scale";
import { handlesFor, resizeSpec } from "../builder/resize";
import { validateEmailHtml } from "./validate";
import type { Block } from "../core/types";

function render(b: Block, icons: "icons" | "letters" | "none" = "icons") {
  const d = newDoc(TEMPLATES[0].id, TEMPLATES[0].design);
  d.mode = "builder";
  d.design.contactIcons = icons;
  Object.assign(d.details, { name: "Jordan", phone: "+1 416 555 0182", email: "j@x.co", website: "x.co", address: "" });
  d.blocks = col([b]);
  return { doc: d, out: renderSignature(d, { variant: "full", mode: "email", resolve: () => "https://img.example.com/x.png" }).html };
}

const iconCount = (html: string) => (html.match(/alt="(Phone|Email|Web)"/g) ?? []).length;

describe("contacts block", () => {
  it("can turn its icons off, or on when the design has none", () => {
    expect(iconCount(render(block("contacts")).out)).toBe(3);
    expect(iconCount(render(block("contacts", { icons: false })).out)).toBe(0);
    for (const layout of ["inline", "grid", "chips"] as const) expect(iconCount(render(block("contacts", { layout, icons: false })).out)).toBe(0);
    expect(iconCount(render(block("contacts", { icons: true }), "none").out)).toBe(3);
    // Letters turned off too.
    expect(render(block("contacts", { icons: false }), "letters").out).not.toContain('font-weight:700;">T</span>');
  });

  it("sets the space between rows and across", () => {
    expect(render(block("contacts", { rowGap: 11 })).out).toContain("padding-top:11px;");
    const grid = render(block("contacts", { layout: "grid", rowGap: 9, colGap: 30 })).out;
    expect(grid).toContain("padding:9px 30px 0 0;");
    expect(render(block("contacts", { layout: "chips", rowGap: 2, colGap: 12 })).out).toContain("padding:0 12px 2px 0;");
  });

  it("one line: pick the divider, its colour and the space either side", () => {
    const out = render(block("contacts", { layout: "inline", separator: "dot", sepColor: "#c8102e", colGap: 30 })).out;
    // A space either side (all Outlook shows) plus padding up to the gap.
    expect(out).toMatch(/&nbsp;<span style="color:#c8102e;padding:0 \d+px;">·<\/span>&nbsp;/);
    expect(out).not.toContain(">|</span>");
    const none = render(block("contacts", { layout: "inline", separator: "none" })).out;
    expect(none).toContain("&#8203;");
    const tight = render(block("contacts", { layout: "inline", colGap: 0 })).out;
    expect(tight).toContain('padding:0 0px;">|</span>');
    expect(validateEmailHtml(out).filter((p) => p.level === "error")).toEqual([]);
  });

  it("canvas edges change the spacing: rows from the bottom, across from the side; corners scale the text", () => {
    const { doc } = render(block("contacts"));
    const list = resizeSpec(doc.blocks!.blocks[0], doc, 200)!;
    // A list has no side-by-side gap, so no side handles.
    expect(handlesFor(list)).toEqual(["nw", "n", "ne", "se", "s", "sw"]);
    const rows = list.stretch!("s", 0, 20, { w: 200, h: 60 });
    const x = structuredClone(doc.blocks!.blocks[0]);
    rows.patch(doc, x);
    // Three lines, two gaps: 20px more spread across them.
    expect(x.type === "contacts" && x.rowGap).toBe(13);
    expect(rows.label).toBe("13px between rows");

    const inline = render(block("contacts", { layout: "inline" }));
    const spec = resizeSpec(inline.doc.blocks!.blocks[0], inline.doc, 400)!;
    expect(handlesFor(spec)).toEqual(["nw", "ne", "e", "se", "sw", "w"]);
    const y = structuredClone(inline.doc.blocks!.blocks[0]);
    spec.stretch!("w", -20, 0, { w: 400, h: 20 }).patch(inline.doc, y);
    expect(y.type === "contacts" && y.colGap).toBe(24);
    expect(spec.label(spec.start)).toMatch(/px text$/);
  });

  it("gaps scale with the signature, and zero stays zero", () => {
    const { doc } = render(block("contacts", { rowGap: 10, colGap: 0 }));
    const s = scaleDoc(doc, 1.5).blocks!.blocks[0];
    expect(s.type === "contacts" && [s.rowGap, s.colGap]).toEqual([15, 0]);
  });
});

describe("contacts block: dividers in every layout, and links per field", () => {
  it("a list can have lines between rows, with the gap either side", () => {
    const out = render(block("contacts", { rowRule: "dashed", sepColor: "#c8102e", rowGap: 6 })).out;
    expect(out).toContain("border-top:1px dashed #c8102e;padding-top:6px;padding-bottom:6px;");
    expect(out.match(/border-top:1px dashed/g)).toHaveLength(2);
  });

  it("grid and chips put a divider symbol between the fields side by side", () => {
    const grid = render(block("contacts", { layout: "grid", separator: "slash", colGap: 40, rowRule: "solid" })).out;
    expect(grid).toMatch(/<span style="color:#[0-9a-f]{6};">\/<\/span>/);
    expect(grid).toContain("padding:0px 20px 0 0;");
    expect(grid).toContain("border-top:1px solid");
    const chips = render(block("contacts", { layout: "chips", separator: "dot" })).out;
    expect(chips.match(/>·<\/span>/g)).toHaveLength(1);
  });

  it("space across goes far wider", () => {
    expect(render(block("contacts", { layout: "grid", colGap: 180 })).out).toContain("180px 0 0;");
  });

  it("each field can link somewhere of its own, or nowhere", () => {
    const out = render(block("contacts", { links: { phone: false, email: "https://cal.com/jordan", website: "x.co/contact" } })).out;
    expect(out).not.toContain('href="tel:');
    expect(out).toContain('href="https://cal.com/jordan"');
    expect(out).toContain('href="https://x.co/contact"');
    // An address can link to a map.
    const d = render(block("contacts", { links: { address: "https://maps.google.com/?q=1+Main+St" } }));
    d.doc.details.address = "1 Main St";
    const withAddress = renderSignature(d.doc, { variant: "full", mode: "email", resolve: () => "https://img.example.com/x.png" }).html;
    expect(withAddress).toContain('href="https://maps.google.com/?q=1+Main+St"');
    // Unsafe schemes are dropped.
    expect(render(block("contacts", { links: { phone: "javascript:alert(1)" } })).out).not.toContain("javascript:");
  });
});

describe("sizes set from the canvas edges", () => {
  it("a text box width wraps the text, and scales with the signature", () => {
    const { doc, out } = render(block("text", { text: "Hello there", style: { width: 180, align: "center" } }));
    expect(out).toContain('width="180" align="center"');
    expect(out).toContain("width:180px;");
    const s = scaleDoc(doc, 1.5).blocks!.blocks[0];
    expect(s.style?.width).toBe(270);
  });

  it("buttons take a width (padding included) and a height; icons a gap; badges a height", () => {
    const btn = render(block("button", { text: "Book", url: "x.co", width: 200, padY: 14 })).out;
    expect(btn).toMatch(/padding:14px \d+px;width:\d+px;text-align:center;/);
    const pad = Number(/padding:14px (\d+)px;width:(\d+)px/.exec(btn)![1]);
    expect(Number(/padding:14px \d+px;width:(\d+)px/.exec(btn)![1]) + 2 * pad).toBe(200);
    const doc = render(block("socials", { gap: 30 })).doc;
    doc.socials = [
      { platform: "linkedin", url: "linkedin.com/in/x" },
      { platform: "x", url: "x.com/x" },
    ] as typeof doc.socials;
    const socials = renderSignature(doc, { variant: "full", mode: "email", resolve: () => "https://img.example.com/x.png" }).html;
    expect(socials).toContain("padding-right:30px;");
    const apps = render(block("apps", { appStore: "apps.apple.com/x", height: 50 })).out;
    expect(apps).toContain('height="50"');
  });
});
