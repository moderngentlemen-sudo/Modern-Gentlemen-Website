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
