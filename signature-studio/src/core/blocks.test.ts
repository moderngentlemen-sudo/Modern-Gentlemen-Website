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

describe("new blocks", () => {
  it("render valid Gmail HTML: logo row, QR, icon line, tag", () => {
    const d = asBuilder(doc("corporate-classic"));
    d.assets.a = { id: "a", name: "a.png", mime: "image/png", width: 300, height: 100, bytes: 1, hash: "ha" };
    d.blocks!.blocks.push(
      block("logos", {
        items: [
          { id: "i1", assetId: "a", link: "example.com/award", alt: "Award" },
          { id: "i2", assetId: "l", alt: "Partner" },
        ],
      }),
      block("qr", { source: "custom", url: "example.com/menu", caption: "Scan for our menu" }),
      block("iconText", { icon: "clock", text: "Mon–Fri, 9–5", url: "" }),
      block("tag", { text: "Now hiring", url: "example.com/jobs", filled: true }),
    );
    const r = renderSignature(d, { variant: "full", mode: "email", resolve: hosted });
    expect([
      ...r.errors,
      ...validateEmailHtml(r.html)
        .filter((p) => p.level === "error")
        .map((p) => p.message),
    ]).toEqual([]);
    expect(r.html).toContain('href="https://example.com/award"');
    expect(r.html).toContain('width="108" height="36"'); // 300×100 logo at 36px tall
    expect(r.html).toContain("Scan for our menu");
    expect(r.images.some((i) => i.kind === "qr" && i.value === "https://example.com/menu")).toBe(true);
    expect(r.images.some((i) => i.kind === "glyph" && i.name === "clock")).toBe(true);
    expect(r.html).toContain("Now hiring");
  });

  it("hidden blocks never reach email, but stay selectable (faded) on the canvas", () => {
    const d = asBuilder(doc("corporate-classic"));
    const t = block("text", { text: "Secret line", visibility: "hidden" });
    d.blocks!.blocks.push(t);
    expect(renderSignature(d, { variant: "full", mode: "email", resolve: hosted }).html).not.toContain("Secret line");
    expect(renderSignature(d, { variant: "full", mode: "preview", sourceUrl: () => "blob:x" }).html).not.toContain("Secret line");
    const editing = renderSignature(d, { variant: "full", mode: "preview", sourceUrl: () => "blob:x", editing: true }).html;
    expect(editing).toContain(`data-block="${t.id}" style="opacity:.3;"`);
  });

  it("crops and frames image blocks", () => {
    const d = asBuilder(doc("corporate-classic"));
    d.blocks!.blocks.push(block("image", { assetId: "p", width: 320, aspect: 16 / 9, crop: { x: 0.5, y: 0, zoom: 2 } }));
    const r = renderSignature(d, { variant: "full", mode: "email", resolve: hosted });
    const req = r.images.find((i) => i.kind === "crop" && i.w === 320);
    expect(req && req.kind === "crop" && req.h).toBe(180);
    expect(req && req.kind === "crop" && req.rect.sw).toBeCloseTo(400, 0); // 800px wide source at 2× zoom
  });
});

describe("whole-signature scale", () => {
  it("scales text, images, icons and widths together, in both modes", () => {
    for (const builder of [false, true]) {
      const base = builder ? asBuilder(doc("corporate-classic")) : doc("corporate-classic");
      const big: SignatureDoc = { ...base, design: { ...base.design, scale: 1.2 } };
      const a = renderSignature(base, { variant: "full", mode: "email", resolve: hosted });
      const b = renderSignature(big, { variant: "full", mode: "email", resolve: hosted });
      const photo = (r: typeof a) => r.images.find((i) => i.kind === "crop" && i.label === "Photo") as { w: number };
      expect(photo(b).w).toBe(Math.round(photo(a).w * 1.2));
      const icon = (r: typeof a) => r.images.find((i) => i.kind === "social") as { size: number };
      expect(icon(b).size).toBe(Math.round(icon(a).size * 1.2));
      expect(b.html).toContain(`font-size:${Math.round(base.design.fontSize * 1.2)}px`);
      expect(validateEmailHtml(b.html).filter((p) => p.level === "error")).toEqual([]);
    }
  });

  it("keeps block ids so the canvas can still select them", () => {
    const d = asBuilder(doc("corporate-classic"));
    d.design.scale = 0.8;
    const p = renderSignature(d, { variant: "full", mode: "preview", sourceUrl: () => "blob:x" }).html;
    for (const { block: b } of walk(d.blocks!)) expect(p).toContain(`data-block="${b.id}"`);
  });
});
