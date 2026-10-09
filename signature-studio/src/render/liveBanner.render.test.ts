import { describe, expect, it } from "vitest";
import { renderSignature } from "./render";
import { block, col } from "../core/blocks";
import { newDoc } from "../core/defaults";
import { TEMPLATES } from "../core/templates";

function doc() {
  const d = newDoc(TEMPLATES[0].id, TEMPLATES[0].design);
  d.details.name = "Jordan";
  d.mode = "builder";
  for (const id of ["main", "sale", "xmas"]) d.assets[id] = { id, name: `${id}.png`, mime: "image/png", width: 1200, height: 300, bytes: 1, hash: `h-${id}` };
  d.blocks = col([
    block("image", {
      assetId: "main",
      width: 480,
      link: "example.com",
      alt: "Our banner",
      live: {
        mode: "schedule",
        slug: "abcdefgh1234",
        items: [
          { id: "1", assetId: "sale", link: "https://example.com/sale", from: "2026-11-24", to: "2026-11-30" },
          { id: "2", assetId: "xmas", from: "2026-12-20", to: "2026-12-26" },
        ],
      },
    }),
  ]);
  return d;
}

describe("live banners in the signature", () => {
  it("the editor shows today's banner", () => {
    const d = doc();
    const html = (now: number) => renderSignature(d, { variant: "full", mode: "preview", sourceUrl: (id) => `blob:${id}`, now }).html;
    expect(html(Date.parse("2026-11-25T10:00:00Z"))).toContain("blob:sale");
    expect(html(Date.parse("2026-11-25T10:00:00Z"))).toContain("https://example.com/sale");
    expect(html(Date.parse("2026-10-01T10:00:00Z"))).toContain("blob:main");
  });

  it("email publishes every picture at one size and points at the live endpoint", () => {
    const r = renderSignature(doc(), {
      variant: "full",
      mode: "email",
      resolve: (q) => `https://img.example.com/${q.key.length}.png`,
      liveBase: "https://p.supabase.co/functions/v1",
    });
    const tagged = r.images.filter((q) => q.live);
    expect(tagged.map((q) => q.live!.item).sort()).toEqual([-1, 0, 1]);
    const sizes = new Set(tagged.map((q) => (q.kind === "crop" ? `${q.w}x${q.h}` : "")));
    expect(sizes.size).toBe(1);
    expect(r.html).toContain('src="https://p.supabase.co/functions/v1/banner/abcdefgh1234/img"');
    expect(r.html).toContain('href="https://p.supabase.co/functions/v1/banner/abcdefgh1234/go"');
  });

  it("without an account the main picture goes out as a normal banner", () => {
    const r = renderSignature(doc(), { variant: "full", mode: "email", resolve: () => "https://img.example.com/x.png" });
    expect(r.html).not.toContain("/banner/");
    expect(r.html).toContain('href="https://example.com/"');
  });
});
