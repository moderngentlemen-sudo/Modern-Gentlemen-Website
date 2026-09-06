import { describe, expect, it } from "vitest";
import { pageSettingsSchema, readPageSettings, pageSettingsMedia } from "./pageSettings";
import { withPageMetadata } from "@/lib/render/pageMetadata";

describe("page settings", () => {
  it("leaves absent settings and existing metadata untouched", () => {
    const base = { title: "Existing title", openGraph: { title: "Existing social title" } };
    expect(withPageMetadata(base, undefined)).toBe(base);
    expect(readPageSettings(undefined)).toEqual({});
  });
  it.each([
    "javascript:alert(1)",
    "//elsewhere.test/image.png",
    "data:text/html,hello",
    "http://insecure.test/video.mp4",
    "https://[invalid/image.jpg",
    "https:///image.jpg",
    "https://user:password@example.com/image.jpg",
    "/\\elsewhere.test/image.jpg",
    "/\n/elsewhere.test/image.jpg",
    "/image\t.jpg",
  ])("refuses unsafe media %s", (backgroundVideo) => {
    expect(pageSettingsSchema.safeParse({ backgroundVideo }).success).toBe(false);
    expect(readPageSettings({ backgroundVideo, header: "hidden" })).toEqual({ header: "hidden" });
  });
  it("bounds presentation values and validates independent mobile choices", () => {
    expect(pageSettingsSchema.safeParse({ overlayOpacity: 1.1, focalX: -1 }).success).toBe(false);
    expect(readPageSettings({ header: "hidden", mobileHeader: "inherit" })).toEqual({
      header: "hidden",
      mobileHeader: "inherit",
    });
  });
  it.each([
    "",
    "/images/a%20b.jpg",
    "/images/a b.jpg",
    "https://example.com/image.jpg?width=800#image",
  ])("retains supported media destinations %s", (url) => {
    const settings = { backgroundImage: url, backgroundVideo: url, socialImage: url };
    expect(pageSettingsSchema.safeParse(settings).success).toBe(true);
    expect(readPageSettings(settings)).toEqual(settings);
  });
  it("preserves inherited Twitter card details when only SEO changes", () => {
    const twitter = {
      card: "summary_large_image" as const,
      site: "@example",
      creator: "@editor",
      images: ["/original.jpg"],
    };
    const result = withPageMetadata({ title: "Original", twitter }, { description: "Updated" });
    expect(result.twitter).toMatchObject({ ...twitter, description: "Updated" });
    expect(twitter.images).toEqual(["/original.jpg"]);
  });
  it("replaces social imagery while keeping Twitter attribution", () => {
    const result = withPageMetadata(
      { twitter: { card: "summary", site: "@example", images: ["/old.jpg"] } },
      { socialImage: "/new.jpg" }
    );
    expect(result.twitter).toMatchObject({
      card: "summary_large_image",
      site: "@example",
      images: ["/new.jpg"],
    });
  });
  it("collects every page media location", () => {
    expect(
      pageSettingsMedia({
        backgroundImage: "/poster.jpg",
        backgroundVideo: "https://example.com/bg.mp4",
        socialImage: "/share.jpg",
      })
    ).toHaveLength(3);
  });
  it("keeps canonical metadata and supplies independent social overrides", () => {
    const result = withPageMetadata(
      { title: "Page", alternates: { canonical: "https://example.com/page" } },
      {
        seoTitle: "Search",
        description: "Description",
        socialTitle: "Social",
        socialDescription: "Social description",
        socialImage: "/share.jpg",
        noIndex: true,
      }
    );
    expect(result.title).toBe("Search — Modern Gentlemen");
    expect(result.alternates).toEqual({ canonical: "https://example.com/page" });
    expect(result.openGraph).toMatchObject({
      title: "Social",
      description: "Social description",
      images: [{ url: "/share.jpg" }],
    });
    expect(result.robots).toEqual({ index: false, follow: true });
  });
});
