import { describe, expect, it } from "vitest";
import { docFromTemplate, templateFromDoc } from "./myTemplates";
import { blocksFromDoc } from "./blocks";
import { newDoc, SAMPLE_DETAILS, SAMPLE_SOCIALS } from "./defaults";
import { TEMPLATES } from "./templates";

describe("my templates", () => {
  it("keep the design but never personal details", () => {
    const d = newDoc("art-deco", TEMPLATES[0].design, "Mine");
    d.details = { ...SAMPLE_DETAILS, custom: [] };
    d.socials = SAMPLE_SOCIALS();
    d.assets.p = { id: "p", name: "p", mime: "image/png", width: 10, height: 10, bytes: 1, hash: "hp" };
    d.assets.l = { id: "l", name: "l", mime: "image/png", width: 30, height: 10, bytes: 1, hash: "hl" };
    d.images.photo.assetId = "p";
    d.images.logo.assetId = "l";
    d.mode = "builder";
    d.blocks = blocksFromDoc(d);
    d.published = { k: { url: "https://x", hash: "h", verifiedAt: 1 } };
    const t = templateFromDoc(d, "Agency look");
    expect(t.doc.details.name).toBe("");
    expect(t.doc.socials).toEqual([]);
    expect(t.doc.images.photo.assetId).toBeUndefined();
    expect(t.doc.assets.p).toBeUndefined();
    expect(t.doc.assets.l).toBeDefined();
    expect(t.doc.published).toEqual({});
    expect(t.doc.blocks!.blocks.length).toBe(d.blocks.blocks.length);

    const a = docFromTemplate(t);
    const b = docFromTemplate(t);
    expect(a.id).not.toBe(b.id);
    expect(a.id).not.toBe(d.id);
    expect(a.name).toBe("Agency look");
    expect(a.templateId).toBe("art-deco");
    a.blocks!.blocks.pop();
    expect(t.doc.blocks!.blocks.length).toBe(d.blocks.blocks.length); // a deep copy
  });
});
