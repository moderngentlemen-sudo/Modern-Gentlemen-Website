import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config.mjs";
import {
  IMAGE_SIZES,
  OPTIMIZABLE_IMAGE_HOSTS,
  isOptimizableImageSrc,
  oneXFromSrcSet,
} from "./images";

describe("isOptimizableImageSrc", () => {
  it("accepts a root-relative path served by this app", () => {
    expect(isOptimizableImageSrc("/images/hero-cover.jpg")).toBe(true);
    expect(isOptimizableImageSrc("/images/a b.png?v=2")).toBe(true);
  });

  it("accepts an allow-listed remote host", () => {
    expect(isOptimizableImageSrc("https://qnfoztnyxhubnnulpfwt.supabase.co/storage/x.jpg")).toBe(
      true
    );
  });

  it("refuses a host that is not allow-listed", () => {
    // The case that matters: an editor pastes a stock-photo URL into a media
    // field. `next/image` throws on this, and on a public route that is a 500 —
    // so it has to come back false and be rendered `unoptimized` instead.
    expect(isOptimizableImageSrc("https://images.unsplash.com/photo-123.jpg")).toBe(false);
    expect(isOptimizableImageSrc("https://supabase.co.evil.example/x.jpg")).toBe(false);
  });

  it("matches a wildcard against exactly one label, as Next does", () => {
    expect(isOptimizableImageSrc("https://one.supabase.co/x.jpg")).toBe(true);
    // Two labels: `*.` is one label in Next's matcher, so this must not match.
    expect(isOptimizableImageSrc("https://a.b.supabase.co/x.jpg")).toBe(false);
    // The bare apex has no label to match either.
    expect(isOptimizableImageSrc("https://supabase.co/x.jpg")).toBe(false);
  });

  it("refuses SVG, whatever the origin", () => {
    // The optimiser answers 400 for image/svg+xml without `dangerouslyAllowSVG`.
    // Both site logos take this branch on every page.
    expect(isOptimizableImageSrc("/mg-logo.svg")).toBe(false);
    expect(isOptimizableImageSrc("/mg-logo.SVG")).toBe(false);
    expect(isOptimizableImageSrc("/logo.svg?v=3")).toBe(false);
    expect(isOptimizableImageSrc("https://x.supabase.co/a/logo.svg#frag")).toBe(false);
  });

  it("refuses inline and protocol-relative sources", () => {
    expect(isOptimizableImageSrc("data:image/png;base64,iVBORw0KG")).toBe(false);
    expect(isOptimizableImageSrc("blob:http://localhost/abc")).toBe(false);
    // Looks root-relative and is not: the host has never been checked.
    expect(isOptimizableImageSrc("//images.unsplash.com/photo.jpg")).toBe(false);
  });

  it("refuses an unusable value rather than throwing", () => {
    expect(isOptimizableImageSrc("")).toBe(false);
    expect(isOptimizableImageSrc(null)).toBe(false);
    expect(isOptimizableImageSrc(undefined)).toBe(false);
    expect(isOptimizableImageSrc("not a url")).toBe(false);
    expect(isOptimizableImageSrc("ftp://example.com/x.jpg")).toBe(false);
  });
});

describe("OPTIMIZABLE_IMAGE_HOSTS agrees with next.config.mjs", () => {
  /**
   * The pair that can drift silently, asserted rather than commented.
   *
   * `isOptimizableImageSrc` decides whether a URL is handed to the optimiser;
   * `remotePatterns` decides whether the optimiser accepts it. If this list is
   * the wider of the two, the difference is a 500 on a public route — and
   * nothing else in the suite would notice, because no test renders an image
   * from an un-allow-listed host.
   */
  it("lists exactly the hostnames the config permits", () => {
    const configured = (nextConfig.images?.remotePatterns ?? []).map((p) => p.hostname);
    expect([...OPTIMIZABLE_IMAGE_HOSTS].sort()).toEqual([...configured].sort());
  });
});

describe("oneXFromSrcSet", () => {
  it("takes the 1x candidate, not the largest", () => {
    // The defect this was written for: `getImageProps().props.src` is the 2x
    // entry, so asking for a 1920px poster fetched a 3840px file.
    const srcSet =
      "/_next/image?url=%2Fimages%2Fhero.jpg&w=1920&q=70 1x, " +
      "/_next/image?url=%2Fimages%2Fhero.jpg&w=3840&q=70 2x";
    expect(oneXFromSrcSet(srcSet)).toBe("/_next/image?url=%2Fimages%2Fhero.jpg&w=1920&q=70");
  });

  it("returns null when there is no 1x candidate to take", () => {
    expect(oneXFromSrcSet(undefined)).toBeNull();
    expect(oneXFromSrcSet("")).toBeNull();
    // A width-descriptor srcset, as `sizes`-driven images produce.
    expect(oneXFromSrcSet("/a.jpg 640w, /b.jpg 1280w")).toBeNull();
  });

  it("splits on candidate commas, not commas inside a URL", () => {
    const srcSet = "https://x.supabase.co/a,b.jpg 1x, https://x.supabase.co/c,d.jpg 2x";
    expect(oneXFromSrcSet(srcSet)).toBe("https://x.supabase.co/a,b.jpg");
  });
});

describe("IMAGE_SIZES", () => {
  it("gives every slot a non-empty media-condition list", () => {
    // A slot whose `sizes` is empty or missing falls back to 100vw inside
    // `next/image`, which is the whole failure this vocabulary exists to stop —
    // and it fails silently, with the right picture at the wrong weight.
    for (const [slot, value] of Object.entries(IMAGE_SIZES)) {
      expect(value, `IMAGE_SIZES.${slot}`).toBeTruthy();
      expect(value, `IMAGE_SIZES.${slot}`).toMatch(/\d/);
    }
  });
});
