import { describe, expect, it } from "vitest";
import {
  block,
  blocksFromDoc,
  col,
  countBlocks,
  duplicateBlock,
  findBlock,
  insertBlock,
  moveBeside,
  moveBlock,
  placeBeside,
  removeBlock,
  rowOf,
  walk,
} from "./blocks";
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

describe("links on text and hover text", () => {
  const html = (d: SignatureDoc) => renderSignature(d, { variant: "full", mode: "email", resolve: hosted }).html;

  it("links words inside a text block, and whole blocks", () => {
    const d = asBuilder(doc("corporate-classic"));
    d.blocks!.blocks.push(
      block("text", { text: "Let's [book a call](calendly.com/jordan) or [email me](jordan@x.co) — [call](+1 416 555 0100)." }),
      block("text", { text: "Unsafe [click](javascript:alert(1)) stays text" }),
    );
    d.blocks!.blocks.unshift(block("name", { link: "linkedin.com/in/jordan" }));
    const h = html(d);
    expect(h).toMatch(/<a href="https:\/\/calendly\.com\/jordan"[^>]*>book a call<\/a>/);
    expect(h).toContain('href="mailto:jordan@x.co"');
    expect(h).toContain('href="tel:+14165550100"');
    expect(h).toMatch(/<a href="https:\/\/linkedin\.com\/in\/jordan"[^>]*>Jordan Ellis<\/a>/);
    expect(h).toContain("Unsafe [click](javascript:alert(1)) stays text");
    expect(h).not.toMatch(/href="javascript:/i);
    expect(validateEmailHtml(h).filter((p) => p.level === "error")).toEqual([]);
  });

  it("adds hover text to a block's links and images", () => {
    const d = asBuilder(doc("corporate-classic"));
    d.blocks!.blocks.push(block("socials", { hover: "Follow along" }), block("text", { text: "[Portfolio](example.com)", hover: 'See "work"' }));
    const h = html(d);
    expect(h).toMatch(/<a title="Follow along" href="https:\/\/linkedin\.com/);
    expect(h).toMatch(/<img title="Follow along" /);
    expect(h).toContain('<a title="See &quot;work&quot;" href="https://example.com/"');
  });
});

describe("placing blocks side by side", () => {
  it("wraps the target in a two-column row, on the chosen side", () => {
    const a = block("text", { text: "A" });
    const b = block("text", { text: "B" });
    const root = col([a]);
    expect(placeBeside(root, b, a.id, "left")).toBe(true);
    const row = root.blocks[0];
    expect(row.type).toBe("row");
    if (row.type !== "row") return;
    expect(row.columns.map((c) => c.blocks[0].id)).toEqual([b.id, a.id]);
  });

  it("adds a column when the target already sits alone in a row's column", () => {
    const a = block("text", { text: "A" });
    const c = block("text", { text: "C" });
    const root = col([rowOf([col([a]), col([c])])]);
    const b = block("text", { text: "B" });
    placeBeside(root, b, a.id, "right");
    const row = root.blocks[0];
    if (row.type !== "row") throw new Error("expected a row");
    expect(row.columns.map((x) => x.blocks[0].id)).toEqual([a.id, b.id, c.id]);
  });

  it("moves an existing block and refuses to move a block beside itself", () => {
    const a = block("text", { text: "A" });
    const b = block("text", { text: "B" });
    const root = col([a, b]);
    expect(moveBeside(root, b.id, b.id, "left")).toBe(false);
    expect(moveBeside(root, b.id, a.id, "right")).toBe(true);
    expect(root.blocks).toHaveLength(1);
    expect(countBlocks(root)).toBe(2);
  });
});

describe("copying inside an edit", () => {
  it("duplicates a block held in an Immer draft", async () => {
    const { produce } = await import("immer");
    const root = col([block("text", { text: "A" })]);
    const out = produce(root, (d) => void duplicateBlock(d, d.blocks[0].id));
    expect(out.blocks).toHaveLength(2);
    expect(out.blocks[1].id).not.toBe(out.blocks[0].id);
  });
});

describe("keyboard navigation order", () => {
  it("steps through blocks in reading order, skipping rows", async () => {
    const { adjacentBlockId } = await import("./blocks");
    const a = block("text", { text: "A" });
    const b = block("text", { text: "B" });
    const c = block("text", { text: "C" });
    const row = rowOf([col([b]), col([c])]);
    const root = col([a, row]);
    expect(adjacentBlockId(root, a.id, 1)).toBe(b.id);
    expect(adjacentBlockId(root, b.id, 1)).toBe(c.id);
    expect(adjacentBlockId(root, c.id, 1)).toBeNull();
    expect(adjacentBlockId(root, b.id, -1)).toBe(a.id);
    expect(adjacentBlockId(root, row.id, 1)).toBe(b.id);
  });
});

describe("breadcrumb path", () => {
  it("lists the rows and columns above a block", async () => {
    const { pathTo, col, rowOf, block } = await import("./blocks");
    const t = block("text", { text: "hi" });
    const inner = col([t]);
    const r = rowOf([col(), inner]);
    const root = col([block("name"), r]);
    const p = pathTo(root, t.id);
    expect(p.map((x) => x.kind)).toEqual(["row", "column"]);
    expect(p[1].kind === "column" && p[1].index).toBe(2);
    expect(pathTo(root, root.blocks[0].id)).toEqual([]);
    expect(pathTo(root, inner.id).map((x) => x.kind)).toEqual(["row"]);
  });
});
