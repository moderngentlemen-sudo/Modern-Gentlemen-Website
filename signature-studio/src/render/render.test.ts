import { describe, expect, it } from "vitest";
import { renderSignature, sliceCard, type ImageRequest } from "./render";
import { validateEmailHtml, GMAIL_SIGNATURE_LIMIT } from "./validate";
import { TEMPLATES } from "../core/templates";
import { newDoc, SAMPLE_DETAILS, SAMPLE_SOCIALS } from "../core/defaults";
import { applyTemplate } from "../core/apply";
import type { SignatureDoc } from "../core/types";
import { cardDataFromDoc, decodeCard, encodeCard, vcard } from "../core/digitalCard";

const hosted = (r: ImageRequest) => `https://img.example.com/s/${encodeURIComponent(r.key).slice(0, 24)}.png`;

function fullDoc(templateId: string): SignatureDoc {
  const doc = newDoc(templateId, TEMPLATES[0].design);
  applyTemplate(doc, templateId);
  doc.details = { ...SAMPLE_DETAILS, mobile: "+1 647 555 0119", custom: [] };
  doc.socials = SAMPLE_SOCIALS();
  doc.assets.p = { id: "p", name: "p.jpg", mime: "image/jpeg", width: 800, height: 1000, bytes: 1, hash: "hp" };
  doc.assets.l = { id: "l", name: "l.png", mime: "image/png", width: 600, height: 200, bytes: 1, hash: "hl" };
  doc.images.photo.assetId = "p";
  doc.images.logo.assetId = "l";
  const a = doc.addons;
  a.signOff.enabled = true;
  a.cta = { enabled: true, text: "Visit us", url: "example.com", style: "solid" };
  a.meeting = { enabled: true, text: "Book a call", url: "cal.com/x" };
  a.disclaimer.enabled = true;
  a.reviews = { enabled: true, rating: 4, text: "Reviews", url: "example.com/r" };
  return doc;
}

describe("templates", () => {
  it("has a large catalog across business sectors and artistic styles", () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(45);
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
    expect(TEMPLATES.filter((t) => t.group === "Business").length).toBeGreaterThanOrEqual(20);
    expect(TEMPLATES.filter((t) => t.group === "Artistic").length).toBeGreaterThanOrEqual(20);
    expect(new Set(TEMPLATES.map((t) => t.layout)).size).toBeGreaterThanOrEqual(14);
  });

  it("includes 12 modern and 10 Modern Gentlemen designs that open in the builder", () => {
    const modern = TEMPLATES.filter((t) => t.group === "Modern");
    const mg = TEMPLATES.filter((t) => t.group === "Modern Gentlemen");
    expect(modern.length).toBeGreaterThanOrEqual(12);
    expect(mg).toHaveLength(10);
    for (const t of mg) {
      expect(t.design.accent === "#c8102e" || t.design.accent === "#141414", t.id).toBe(true);
      expect(t.design.headingFont, t.id).toBe("space-grotesk");
    }
    for (const t of [...modern, ...mg]) {
      const doc = fullDoc(t.id);
      expect(doc.mode, t.id).toBe("builder");
      const html = renderSignature(doc, { variant: "full", mode: "email", resolve: hosted }).html;
      expect(html, t.id).toContain("Jordan Ellis");
    }
    // The MG look: Instrument Serif accents and IBM Plex Mono labels.
    const ed = renderSignature(fullDoc("mg-editorial"), { variant: "full", mode: "email", resolve: hosted }).html;
    expect(ed).toContain("'Instrument Serif'");
    expect(ed).toContain("'IBM Plex Mono'");
    expect(ed).toContain("text-transform:uppercase");
  });

  it("every template renders valid, Gmail-sized HTML in Full and Reply", () => {
    for (const t of TEMPLATES) {
      const doc = fullDoc(t.id);
      for (const variant of ["full", "reply"] as const) {
        const r = renderSignature(doc, { variant, mode: "email", resolve: hosted });
        const errs = [
          ...r.errors,
          ...validateEmailHtml(r.html)
            .filter((p) => p.level === "error")
            .map((p) => p.message),
        ];
        expect(errs, `${t.id}/${variant}`).toEqual([]);
        expect(r.html.length, `${t.id}/${variant} length`).toBeLessThan(GMAIL_SIGNATURE_LIMIT);
        expect(r.html).toContain("Jordan Ellis");
        expect(r.html).not.toMatch(/data:|blob:|<script/);
      }
    }
  });

  it("reply is compact and drops add-ons", () => {
    const doc = fullDoc("corporate-classic");
    const full = renderSignature(doc, { variant: "full", mode: "email", resolve: hosted }).html;
    const reply = renderSignature(doc, { variant: "reply", mode: "email", resolve: hosted }).html;
    expect(full).toContain("Book a call");
    expect(reply).not.toContain("Book a call");
    expect(reply).not.toContain("confidential");
    expect(reply.length).toBeLessThan(full.length);
  });

  it("switching template keeps content", () => {
    const doc = fullDoc("corporate-classic");
    applyTemplate(doc, "art-deco");
    expect(doc.details.name).toBe("Jordan Ellis");
    expect(doc.images.logo.assetId).toBe("l");
    expect(doc.addons.cta.enabled).toBe(true);
    expect(doc.design.headingFont).toBe("cormorant");
  });

  it("missing images are errors in email mode, never silent", () => {
    const doc = fullDoc("corporate-classic");
    const r = renderSignature(doc, { variant: "full", mode: "email", resolve: () => null });
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.html).not.toContain("<img");
  });
});

describe("business card slicing", () => {
  it("covers the card exactly and links only hotspot cells", () => {
    const bands = sliceCard(420, 240, [
      { x: 0.6, y: 0.2, w: 0.35, h: 0.15, href: "tel:1" },
      { x: 0.6, y: 0.4, w: 0.35, h: 0.15, href: "mailto:a@b.co" },
      { x: 0.05, y: 0.75, w: 0.3, h: 0.15, href: "https://x.co" },
    ]);
    let area = 0;
    for (const band of bands) {
      expect(band.reduce((s, c) => s + c.w, 0)).toBe(420);
      for (const c of band) area += c.w * c.h;
    }
    expect(area).toBe(420 * 240);
    expect(
      bands
        .flat()
        .filter((c) => c.href)
        .map((c) => c.href)
        .sort(),
    ).toEqual(["https://x.co", "mailto:a@b.co", "tel:1"]);
    expect(bands.flat().length).toBeLessThan(20);
  });

  it("renders a sliced, clickable card that passes validation", () => {
    const doc = fullDoc("corporate-classic");
    doc.assets.c = { id: "c", name: "card.png", mime: "image/png", width: 1050, height: 600, bytes: 1, hash: "hc" };
    doc.card = {
      ...doc.card,
      enabled: true,
      assetId: "c",
      cardOnly: true,
      digitalLink: true,
      hotspots: [{ id: "h", x: 0.1, y: 0.7, w: 0.4, h: 0.15, action: "email", label: "Email me" }],
    };
    doc.digitalCardUrl = "https://studio.example.com/?card=abc";
    const r = renderSignature(doc, { variant: "full", mode: "email", resolve: hosted });
    expect(validateEmailHtml(r.html).filter((p) => p.level === "error")).toEqual([]);
    expect(r.html).toContain('href="mailto:jordan@moderngentlemen.co"');
    expect(r.html).toContain("View my digital business card");
    expect(r.images.filter((i) => i.kind === "slice").length).toBeGreaterThan(1);
  });
});

describe("Canva signature design", () => {
  function canvaDoc(): SignatureDoc {
    const doc = fullDoc("corporate-classic");
    // A 1200×400 Canva export (2×), shown at 600×200.
    doc.assets.cv = { id: "cv", name: "canva.png", mime: "image/png", width: 1200, height: 400, bytes: 1, hash: "hcv" };
    doc.card = {
      ...doc.card,
      enabled: true,
      kind: "signature",
      cardOnly: true,
      digitalLink: false,
      inReplies: true,
      radius: 0,
      width: 600,
      assetId: "cv",
      hotspots: [
        { id: "a", x: 0.55, y: 0.3, w: 0.4, h: 0.12, action: "email", label: "Email" },
        { id: "b", x: 0.55, y: 0.45, w: 0.4, h: 0.12, action: "website", label: "Website" },
        { id: "c", x: 0.05, y: 0.8, w: 0.06, h: 0.12, action: "linkedin", label: "LinkedIn" },
      ],
    };
    doc.addons.signOff.enabled = false;
    doc.addons.cta.enabled = false;
    doc.addons.meeting.enabled = false;
    doc.addons.disclaimer.enabled = false;
    doc.addons.reviews.enabled = false;
    return doc;
  }

  it("keeps the design's exact size and replaces the text signature", () => {
    const r = renderSignature(canvaDoc(), { variant: "full", mode: "email", resolve: hosted });
    expect(validateEmailHtml(r.html).filter((p) => p.level === "error")).toEqual([]);
    expect(r.html).toContain('width="600"');
    expect(r.html).not.toContain("Creative Director"); // no generated text signature
    expect(r.html).toContain('alt="Jordan Ellis – email signature"');
    const slices = r.images.filter((i) => i.kind === "slice");
    // Slices tile the whole 600×200 design with no gaps or overlaps.
    expect(slices.reduce((s, i) => s + (i.kind === "slice" ? i.w * i.h : 0), 0)).toBe(600 * 200);
    expect(r.html).toContain('href="mailto:jordan@moderngentlemen.co"');
    expect(r.html).toContain('href="https://moderngentlemen.co/"');
    expect(r.html).toContain('href="https://linkedin.com/company/moderngentlemen"');
    expect(r.html.length).toBeLessThan(GMAIL_SIGNATURE_LIMIT);
  });

  it("is used in replies when asked, and falls back to text otherwise", () => {
    const doc = canvaDoc();
    const reply = renderSignature(doc, { variant: "reply", mode: "email", resolve: hosted }).html;
    expect(reply).toContain('width="600"');
    expect(reply).not.toContain("Creative Director");
    doc.card.inReplies = false;
    const text = renderSignature(doc, { variant: "reply", mode: "email", resolve: hosted }).html;
    expect(text).toContain("Creative Director");
  });
});

describe("digital card", () => {
  it("round-trips through a compact link and produces a vCard", async () => {
    const doc = fullDoc("corporate-classic");
    const data = cardDataFromDoc(doc, { front: "https://img.example.com/s/f.png" });
    const token = await encodeCard(data);
    expect(token.length).toBeLessThan(1200);
    expect(await decodeCard(token)).toEqual(JSON.parse(JSON.stringify(data)));
    const v = vcard(data);
    expect(v).toContain("FN:Jordan Ellis");
    expect(v).toContain("EMAIL;TYPE=INTERNET:jordan@moderngentlemen.co");
  });
  it("rejects garbage tokens", async () => {
    await expect(decodeCard("not-a-card")).rejects.toThrow();
  });
});

describe("Made with link", () => {
  it("is a small, public link under new-email signatures by default", () => {
    const doc = fullDoc("corporate-classic");
    const full = renderSignature(doc, { variant: "full", mode: "email", resolve: hosted }).html;
    expect(full).toContain(">Made with Signet</a>");
    expect(full).toContain('href="https://modern-gentlemen-website.pages.dev/?ref=signature"');
    expect(validateEmailHtml(full).filter((p) => p.level === "error")).toEqual([]);
  });

  it("stays out of replies and disappears when switched off", () => {
    const doc = fullDoc("corporate-classic");
    expect(renderSignature(doc, { variant: "reply", mode: "email", resolve: hosted }).html).not.toContain("Made with");
    doc.madeWith = false;
    expect(renderSignature(doc, { variant: "full", mode: "email", resolve: hosted }).html).not.toContain("Made with");
  });

  it("is dropped rather than push a signature past Gmail's limit", () => {
    const doc = fullDoc("corporate-classic");
    const size = (credit: boolean) => renderSignature({ ...doc, madeWith: credit }, { variant: "full", mode: "email", resolve: hosted }).html.length;
    // Grow the signature until it fits on its own but not with the credit.
    let n = 0;
    doc.details.custom.push({ id: "f", label: "O", value: "Line" });
    while (size(false) < GMAIL_SIGNATURE_LIMIT - 1500) doc.details.custom.push({ id: `f${n}`, label: "O", value: `Line ${n++}` });
    // Pad the last line so the signature sits 50 characters under the limit.
    const last = doc.details.custom[doc.details.custom.length - 1];
    last.value += "x".repeat(GMAIL_SIGNATURE_LIMIT - 50 - size(false));
    expect(size(false)).toBe(GMAIL_SIGNATURE_LIMIT - 50);
    const html = renderSignature(doc, { variant: "full", mode: "email", resolve: hosted }).html;
    expect(html).not.toContain("Made with");
    expect(html.length).toBeLessThanOrEqual(GMAIL_SIGNATURE_LIMIT);
  });

  it("is never added to an empty signature", () => {
    const doc = fullDoc("corporate-classic");
    doc.details = { ...doc.details, name: "", title: "", company: "", phone: "", mobile: "", email: "", website: "", address: "" };
    doc.socials = [];
    doc.images = { photo: { ...doc.images.photo, assetId: undefined }, logo: { ...doc.images.logo, assetId: undefined } };
    Object.values(doc.addons).forEach((a) => (a.enabled = false));
    expect(renderSignature(doc, { variant: "full", mode: "email", resolve: hosted }).html).toBe("");
  });
});

describe("separate reply layout", () => {
  it("renders replyBlocks for replies when the reply has its own layout", async () => {
    const { blocksFromDoc, block, col } = await import("../core/blocks");
    const d = newDoc(TEMPLATES[0].id, TEMPLATES[0].design);
    d.details.name = "Jordan Ellis";
    d.mode = "builder";
    d.blocks = blocksFromDoc(d);
    d.replyBlocks = col([block("text", { text: "Thanks — J." })]);
    const opts = { mode: "email" as const, resolve: () => "https://img.example.com/a.png" };
    expect(renderSignature(d, { ...opts, variant: "reply" }).html).toContain("Jordan Ellis");
    d.reply.custom = true;
    const reply = renderSignature(d, { ...opts, variant: "reply" }).html;
    expect(reply).toContain("Thanks — J.");
    expect(reply).not.toContain("Jordan Ellis");
    expect(renderSignature(d, { ...opts, variant: "full" }).html).toContain("Jordan Ellis");
  });
});

describe("right-to-left", () => {
  it("mirrors alignment, paddings and borders and marks the signature rtl", async () => {
    const { mirrorRtl } = await import("./render");
    const out = mirrorRtl(
      '<table style="x"><tr><td style="text-align:left;padding-left:8px;border-left:3px solid red;padding:0 6px 4px 0;" align="left">a</td></tr></table>',
    );
    expect(out).toContain('<table dir="rtl" style="direction:rtl;x"');
    expect(out).toContain("text-align:right;padding-right:8px;border-right:3px solid red;padding:0 0 4px 6px;");
    expect(out).toContain('align="right"');
    // Latin text keeps its order; Arabic text is left to the bidi algorithm.
    expect(mirrorRtl("<table><tr><td>+1 416 555 0182</td><td>ليلى 1</td></tr></table>")).toContain(
      '<td><span dir="ltr">+1 416 555 0182</span></td><td>ليلى 1</td>',
    );
  });

  it("renders a whole signature right-to-left and still passes the email checks", () => {
    const d = fullDoc(TEMPLATES[0].id);
    d.details.name = "ليلى حداد";
    d.design.direction = "rtl";
    const { html } = renderSignature(d, { variant: "full", mode: "email", resolve: hosted });
    expect(html.startsWith('<table dir="rtl"')).toBe(true);
    expect(validateEmailHtml(html).filter((p) => p.level === "error")).toEqual([]);
  });
});

describe("text studio rendering", () => {
  it("applies block typography to every text element, and colour roles", async () => {
    const { withTypography, styleColor } = await import("./render");
    const out = withTypography('<div style="font-family:Arial;font-size:13px;">Hi</div><img src="x" style="display:block">', {
      weight: 600,
      italic: true,
      underline: true,
      case: "smallcaps",
      lineHeight: 1.6,
      tracking: 0.1,
    });
    expect(out).toContain(
      "font-family:Arial;font-size:13px;font-weight:600;font-style:italic;text-decoration:underline;font-variant:small-caps;line-height:160%;letter-spacing:0.1em;",
    );
    expect(out).toContain('<img src="x" style="display:block">');
    const d = fullDoc(TEMPLATES[0].id).design;
    expect(styleColor({ colorRole: "accent" }, d)).toBe(d.accent);
    expect(styleColor({ colorRole: "accent", color: "#123456" }, d)).toBe("#123456");
  });

  it("renders inline marks in a text block as Gmail-safe tags", async () => {
    const { blocksFromDoc, block } = await import("../core/blocks");
    const d = fullDoc(TEMPLATES[0].id);
    d.mode = "builder";
    d.blocks = blocksFromDoc(d);
    d.blocks.blocks.push(block("text", { text: "Call **today** for ==20%== off, ~~old~~ __new__ *price* [here]{#C8102E}" }));
    const { html } = renderSignature(d, { variant: "full", mode: "email", resolve: hosted });
    expect(html).toContain('<strong style="font-weight:700;">today</strong>');
    expect(html).toMatch(/<span style="background-color:#[0-9a-f]{6};padding:0 2px;">20%<\/span>/);
    expect(html).toContain('<s style="text-decoration:line-through;">old</s>');
    expect(html).toContain('<u style="text-decoration:underline;">new</u>');
    expect(html).toContain('<em style="font-style:italic;">price</em>');
    expect(html).toContain('<span style="color:#C8102E;">here</span>');
    expect(html).not.toContain("**");
    expect(validateEmailHtml(html).filter((p) => p.level === "error")).toEqual([]);
  });
});
