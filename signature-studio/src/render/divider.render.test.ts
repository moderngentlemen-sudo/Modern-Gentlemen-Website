import { describe, expect, it } from "vitest";
import { renderSignature } from "./render";
import { block, col } from "../core/blocks";
import { newDoc } from "../core/defaults";
import { TEMPLATES } from "../core/templates";
import { scaleDoc } from "../core/scale";
import { resizeSpec } from "../builder/resize";
import { validateEmailHtml } from "./validate";
import type { Block } from "../core/types";

function html(b: Block) {
  const d = newDoc(TEMPLATES[0].id, TEMPLATES[0].design);
  d.details.name = "Jordan";
  d.mode = "builder";
  d.blocks = col([b]);
  return { doc: d, out: renderSignature(d, { variant: "full", mode: "email", resolve: () => "https://img.example.com/x.png" }).html };
}

describe("dividers", () => {
  it("a plain divider renders exactly as before", () => {
    const { out } = html(block("divider", { width: 200 }));
    expect(out).toContain(
      '<table cellpadding="0" cellspacing="0" border="0" role="presentation" width="200" style="border-collapse:collapse;width:200px;"><tr><td style="border-top:1px solid #bec2cd;font-size:1px;line-height:1px;height:1px;">&nbsp;</td></tr></table>',
    );
    expect(out).not.toContain("padding:0px");
  });

  it("uses the colour picked on the block", () => {
    const { out } = html(block("divider", { style: { accent: "#c8102e" } }));
    expect(out).toContain("border-top:1px solid #c8102e");
  });

  it("adds spacing above and below, padding at the ends, and a line style", () => {
    const { out } = html(block("divider", { spacing: 12, padding: 20, lineStyle: "dashed" }));
    expect(out).toContain("padding:12px 20px;");
    expect(out).toContain("dashed");
  });

  it("can stand vertically, with spacing left and right, and Gmail-safe markup", () => {
    const { out } = html(block("divider", { vertical: true, height: 60, spacing: 10, padding: 4, thickness: 2 }));
    expect(out).toMatch(/border-left:2px solid #[0-9a-f]{6};[^"]*height:60px;/);
    expect(out).toContain('height="60"');
    expect(out).toContain("padding:4px 10px;");
    expect(validateEmailHtml(out).filter((p) => p.level === "error")).toEqual([]);
  });

  it("vertical dividers resize up and down; sizes scale with the signature but zero stays zero", () => {
    const { doc } = html(block("divider", { vertical: true, height: 60, spacing: 0, padding: 6 }));
    const b = doc.blocks!.blocks[0];
    const spec = resizeSpec(b, doc, 100)!;
    expect(spec.axis).toBe("y");
    expect(spec.start).toBe(60);
    const s = scaleDoc(doc, 1.5).blocks!.blocks[0];
    expect(s.type === "divider" && [s.height, s.spacing, s.padding]).toEqual([90, 0, 9]);
  });
});
