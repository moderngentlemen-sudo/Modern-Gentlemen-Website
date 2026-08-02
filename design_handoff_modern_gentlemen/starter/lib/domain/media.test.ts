import { describe, expect, it } from "vitest";

import {
  formatByteSize,
  isPickableAs,
  mediaKindFromMime,
  publicUrlFor,
  slugifyFileName,
  storagePathFor,
  storagePathFromPublicUrl,
} from "./media";

const PROJECT = "https://qnfoztnyxhubnnulpfwt.supabase.co";

describe("mediaKindFromMime", () => {
  it.each([
    ["image/jpeg", "image"],
    ["image/png", "image"],
    ["image/svg+xml", "image"],
    ["video/mp4", "video"],
    ["audio/mpeg", "audio"],
    ["application/pdf", "document"],
  ])("maps %s to %s", (mime, kind) => {
    expect(mediaKindFromMime(mime)).toBe(kind);
  });

  it("separates gif from the other images, because editors do", () => {
    expect(mediaKindFromMime("image/gif")).toBe("gif");
  });

  it("is tolerant of the casing and padding a browser can hand us", () => {
    expect(mediaKindFromMime("  IMAGE/JPEG ")).toBe("image");
  });

  it("returns null rather than guessing at a type it does not know", () => {
    expect(mediaKindFromMime("application/x-shockwave-flash")).toBeNull();
    expect(mediaKindFromMime("")).toBeNull();
  });
});

describe("isPickableAs", () => {
  it("offers gifs to an image field — they are what a still field is asked to hold", () => {
    expect(isPickableAs("gif", "image")).toBe(true);
    expect(isPickableAs("image", "image")).toBe(true);
  });

  it("keeps a video out of an image field, and everything else out of a video field", () => {
    expect(isPickableAs("video", "image")).toBe(false);
    expect(isPickableAs("gif", "video")).toBe(false);
    expect(isPickableAs("document", "image")).toBe(false);
  });
});

describe("slugifyFileName", () => {
  it("keeps the extension and lower-cases it", () => {
    expect(slugifyFileName("Hero.JPG")).toBe("hero.jpg");
  });

  it("folds accents to their base letters instead of dropping them", () => {
    expect(slugifyFileName("Café Racer.png")).toBe("cafe-racer.png");
  });

  it("collapses punctuation and runs of separators to single hyphens", () => {
    expect(slugifyFileName("Ferrari 250 GTO (final)·v2.JPG")).toBe("ferrari-250-gto-final-v2.jpg");
  });

  it("never returns a bare extension for a name that slugifies to nothing", () => {
    expect(slugifyFileName("···.png")).toBe("asset.png");
  });

  it("handles a name with no extension at all", () => {
    expect(slugifyFileName("LICENSE")).toBe("license");
  });

  it("treats a leading dot as part of the name, not as an extension", () => {
    // `.gitignore` has no stem; lastIndexOf(".") is 0, so there is no extension
    // to split off and the whole thing is the name.
    expect(slugifyFileName(".gitignore")).toBe("gitignore");
  });

  it("caps the stem so an essay-length filename cannot become the object key", () => {
    const slug = slugifyFileName(`${"a".repeat(200)}.jpg`);
    expect(slug).toBe(`${"a".repeat(80)}.jpg`);
  });
});

describe("storagePathFor", () => {
  it("partitions by UTC year and month and carries the collision token", () => {
    const path = storagePathFor("Hero Cover.jpg", "ab12cd34", new Date("2026-08-02T12:00:00Z"));
    expect(path).toBe("2026/08/ab12cd34-hero-cover.jpg");
  });

  it("pads a single-digit month, so the prefixes sort lexically", () => {
    const path = storagePathFor("x.png", "tok", new Date("2026-01-09T00:00:00Z"));
    expect(path).toBe("2026/01/tok-x.png");
  });

  it("separates two uploads of the same filename in the same month", () => {
    const now = new Date("2026-08-02T12:00:00Z");
    expect(storagePathFor("hero.jpg", "aaaa", now)).not.toBe(
      storagePathFor("hero.jpg", "bbbb", now)
    );
  });
});

describe("publicUrlFor / storagePathFromPublicUrl", () => {
  it("round-trips a plain path", () => {
    const url = publicUrlFor(PROJECT, "2026/08/ab12-hero.jpg");
    expect(url).toBe(`${PROJECT}/storage/v1/object/public/media/2026/08/ab12-hero.jpg`);
    expect(storagePathFromPublicUrl(url)).toBe("2026/08/ab12-hero.jpg");
  });

  it("round-trips a path holding characters a URL must escape", () => {
    const path = "2026/08/ab12-a b.jpg";
    expect(storagePathFromPublicUrl(publicUrlFor(PROJECT, path))).toBe(path);
  });

  it("tolerates a trailing slash on the project URL and a leading one on the path", () => {
    expect(publicUrlFor(`${PROJECT}/`, "/2026/08/x.jpg")).toBe(
      `${PROJECT}/storage/v1/object/public/media/2026/08/x.jpg`
    );
  });

  it("reverses a transformed URL to the same object as the plain one", () => {
    // Resizing an image in the builder must not orphan its usage record.
    const rendered = `${PROJECT}/storage/v1/render/image/public/media/2026/08/hero.jpg?width=800`;
    expect(storagePathFromPublicUrl(rendered)).toBe("2026/08/hero.jpg");
  });

  it("ignores a query string on a plain object URL", () => {
    const url = `${PROJECT}/storage/v1/object/public/media/2026/08/hero.jpg?t=1`;
    expect(storagePathFromPublicUrl(url)).toBe("2026/08/hero.jpg");
  });

  it("matches on the bucket-scoped path, not the host", () => {
    // A custom storage domain in front of the project serves the same object.
    const url = "https://cdn.moderngentlemen.co/storage/v1/object/public/media/2026/08/hero.jpg";
    expect(storagePathFromPublicUrl(url)).toBe("2026/08/hero.jpg");
  });

  it("returns null for anything this project does not serve", () => {
    expect(storagePathFromPublicUrl("/images/hero-cover.jpg")).toBeNull();
    expect(storagePathFromPublicUrl("https://cdn.example.com/trailer.mp4")).toBeNull();
    expect(storagePathFromPublicUrl("")).toBeNull();
  });

  it("returns null for another bucket, so its objects cannot be claimed as ours", () => {
    const url = `${PROJECT}/storage/v1/object/public/avatars/2026/08/hero.jpg`;
    expect(storagePathFromPublicUrl(url)).toBeNull();
  });

  it("returns null for the bucket root with no object after it", () => {
    expect(storagePathFromPublicUrl(`${PROJECT}/storage/v1/object/public/media/`)).toBeNull();
  });

  it("returns null for a malformed percent-escape rather than throwing", () => {
    const url = `${PROJECT}/storage/v1/object/public/media/2026/08/%E0%A4%A.jpg`;
    expect(storagePathFromPublicUrl(url)).toBeNull();
  });
});

describe("formatByteSize", () => {
  it.each([
    [0, "0 B"],
    [512, "512 B"],
    [1024, "1 KB"],
    [1536, "1.5 KB"],
    [2 * 1024 * 1024, "2 MB"],
    [1024 * 1024 * 1024, "1 GB"],
  ])("formats %i as %s", (bytes, expected) => {
    expect(formatByteSize(bytes)).toBe(expected);
  });

  it("does not run past gigabytes", () => {
    expect(formatByteSize(5 * 1024 ** 4)).toBe("5120 GB");
  });

  it("returns a dash for a value that is not a size", () => {
    expect(formatByteSize(Number.NaN)).toBe("—");
    expect(formatByteSize(-1)).toBe("—");
  });
});
