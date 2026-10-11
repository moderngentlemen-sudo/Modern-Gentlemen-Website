import { describe, expect, it } from "vitest";
import { renderSignature, PHONE_STYLE } from "./render";
import { block, col } from "../core/blocks";
import { newDoc } from "../core/defaults";
import { TEMPLATES } from "../core/templates";
import { htmlToPlainText, validateEmailHtml } from "./validate";

function doc() {
  const d = newDoc(TEMPLATES[0].id, TEMPLATES[0].design);
  d.mode = "builder";
  Object.assign(d.details, { name: "Jordan Ellis", phone: "+1 416 555 0182", email: "j@x.co" });
  d.blocks = col([block("name"), block("text", { text: "Desktop words" }), block("contacts", { layout: "inline" })]);
  d.phoneBlocks = structuredClone(d.blocks);
  (d.phoneBlocks.blocks[1] as Extract<(typeof d.phoneBlocks.blocks)[number], { type: "text" }>).text = "Phone words";
  d.phoneBlocks.blocks[2] = { ...d.phoneBlocks.blocks[2], layout: "stacked" } as (typeof d.phoneBlocks.blocks)[number];
  return d;
}
const email = (phoneLayout: boolean) =>
  renderSignature(doc(), { variant: "full", mode: "email", resolve: () => "https://img.example.com/x.png", phoneLayout }).html;

describe("phone layout", () => {
  it("the editor's phone view shows the phone layout; desktop is untouched", () => {
    const d = doc();
    const phone = renderSignature(d, { variant: "full", mode: "preview", layout: "phone" }).html;
    const desk = renderSignature(d, { variant: "full", mode: "preview" }).html;
    expect(phone).toContain("Phone words");
    expect(desk).toContain("Desktop words");
    expect(desk).not.toContain("Phone words");
  });

  it("email for Gmail carries the desktop layout only", () => {
    const html = email(false);
    expect(html).toContain("Desktop words");
    expect(html).not.toContain("Phone words");
    expect(html).not.toContain("<style>");
  });

  it("email for other apps carries both, swapped by a media query, and still validates", () => {
    const html = email(true);
    expect(html.startsWith(PHONE_STYLE)).toBe(true);
    expect(html).toMatch(
      /<div class="sg-d">.*Desktop words.*<\/div><div class="sg-m" style="display:none;max-height:0;overflow:hidden;mso-hide:all;">.*Phone words/s,
    );
    expect(validateEmailHtml(html).filter((p) => p.level === "error")).toEqual([]);
    expect(validateEmailHtml(html).some((p) => /class/.test(p.message))).toBe(false);
    // Plain text has the signature once.
    expect(htmlToPlainText(html)).not.toContain("Phone words");
    // Any other <style> is still refused.
    expect(validateEmailHtml(`<style>a{color:red}</style>${html}`).some((p) => p.level === "error")).toBe(true);
  });

  it("replies are not affected", () => {
    const html = renderSignature(doc(), { variant: "reply", mode: "email", resolve: () => "https://img.example.com/x.png", phoneLayout: true }).html;
    expect(html).not.toContain("sg-m");
  });
});
