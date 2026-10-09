import { describe, expect, it } from "vitest";
import { block, blocksFromDoc, col, countBlocks, duplicateBlock, findBlock, insertBlock, moveBlock, removeBlock, rowOf, walk } from "./blocks";
import { applyTemplate } from "./apply";
import { newDoc, SAMPLE_DETAILS, SAMPLE_SOCIALS } from "./defaults";
import { TEMPLATES } from "./templates";
import type { SignatureDoc } from "./types";
import { renderSignature, type ImageRequest } from "../render/render";
import { GMAIL_SIGNATURE_LIMIT, validateEmailHtml } from "../render/validate";

const hosted = (r: ImageRequest) => `https://img.example.com/s/${encodeURIComponent(r.key).slice(0, 24)}.png`;

function doc(templateId: string): SignatureDoc {
  const d = newDoc(templateId, TEMPLATES[0].design);
  applyTemplate(d, templateId);
  d.details = { ...SAMPLE_DETAILS, custom: [] };
  d.socials = SAMPLE_SOCIALS();
  d.assets.p = { id: "p", name: "p.jpg", mime: "image/jpeg", width: 800, height: 800, bytes: 1, hash: "hp" };
  d.assets.l = { id: "l", name: "l.png", mime: "image/png", width: 600, height: 200, bytes: 1, hash: "hl" };
  d.images.photo.assetId = "p";
  d.images.logo.assetId = "l";
  d.addons.cta.enabled = true;
  d.addons.meeting = { enabled: true, text: "Book a call", url: "cal.com/x" };
  d.addons.disclaimer.enabled = true;
  return d;
}

function asBuilder(d: SignatureDoc): SignatureDoc {
  return { ...d, mode: "builder", blocks: blocksFromDoc(d) };
}

describe("builder layouts", () => {
  it("every template opens in the builder and renders valid Gmail HTML", () => {
    for (const t of TEMPLATES) {
      const d = asBuilder(doc(t.id));
      const r = renderSignature(d, { variant: "full", mode: "email", resolve: hosted });
      const errs = [
        ...r.errors,
        ...validateEmailHtml(r.html)
          .filter((p) => p.level === "error")
          .map((p) => p.message),
      ];
      expect(errs, t.id).toEqual([]);
      expect(r.html, t.id).toContain("Jordan Ellis");
      expect(r.html, t.id).toContain("Book a call");
      expect(r.html, t.id).toContain("confidential");
      expect(r.html.length, t.id).toBeLessThan(GMAIL_SIGNATURE_LIMIT);
      expect(r.html, t.id).not.toMatch(/data-block|data-col|Drop blocks/);
    }
  });

  it("marks blocks for the editor only in preview, with placeholders for empty slots", () => {
    const d = asBuilder(doc("corporate-classic"));
    d.blocks!.blocks.push(rowOf([col(), col()]));
    const p = renderSignature(d, { variant: "full", mode: "preview", sourceUrl: () => "blob:x" }).html;
    for (const { block: b } of walk(d.blocks!)) expect(p).toContain(`data-block="${b.id}"`);
    expect(p).toContain("Drop blocks here");
  });

  it("respects per-block visibility", () => {
    const d = asBuilder(doc("corporate-classic"));
    d.reply.compact = false;
    d.blocks!.blocks.push(block("text", { text: "Full only line", visibility: "full" }), block("text", { text: "Reply only line", visibility: "reply" }));
    const full = renderSignature(d, { variant: "full", mode: "email", resolve: hosted }).html;
    const reply = renderSignature(d, { variant: "reply", mode: "email", resolve: hosted }).html;
    expect(full).toContain("Full only line");
    expect(full).not.toContain("Reply only line");
    expect(reply).toContain("Reply only line");
    expect(reply).not.toContain("Full only line");
  });

  it("applies block style overrides", () => {
    const d = asBuilder(doc("corporate-classic"));
    d.blocks!.blocks.unshift(block("text", { text: "Hello", style: { color: "#ff0000", fontSize: 20 } }));
    const html = renderSignature(d, { variant: "full", mode: "email", resolve: hosted }).html;
    expect(html).toMatch(/font-size:20px;[^"]*color:#ff0000;[^"]*">Hello/);
  });
});

describe("tree operations", () => {
  it("inserts, moves across columns and removes", () => {
    const left = col();
    const right = col();
    const root = col([rowOf([left, right])]);
    const a = block("name");
    const b = block("title");
    insertBlock(root, a, left.id, 0);
    insertBlock(root, b, left.id, 1);
    expect(moveBlock(root, b.id, right.id, 0)).toBe(true);
    expect(findBlock(root, b.id)!.parent.id).toBe(right.id);
    expect(moveBlock(root, a.id, root.id, 0)).toBe(true);
    expect(root.blocks[0].id).toBe(a.id);
    expect(removeBlock(root, a.id)!.id).toBe(a.id);
    expect(countBlocks(root)).toBe(1);
  });

  it("moves down within the same column by index", () => {
    const root = col([block("name"), block("title"), block("contacts")]);
    const first = root.blocks[0].id;
    moveBlock(root, first, root.id, 3);
    expect(root.blocks[2].id).toBe(first);
  });

  it("refuses to drop a row into itself", () => {
    const inner = col();
    const r = rowOf([inner, col()]);
    const root = col([r]);
    expect(moveBlock(root, r.id, inner.id, 0)).toBe(false);
    expect(root.blocks[0]).toBe(r);
  });

  it("duplicates with fresh ids all the way down", () => {
    const r = rowOf([col([block("name")]), col([block("photo")])]);
    const root = col([r]);
    const copy = duplicateBlock(root, r.id)!;
    const ids = [...walk(root)].map((x) => x.block.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(copy.type === "row" && copy.columns[0].id).not.toBe(r.type === "row" && r.columns[0].id);
  });
});
