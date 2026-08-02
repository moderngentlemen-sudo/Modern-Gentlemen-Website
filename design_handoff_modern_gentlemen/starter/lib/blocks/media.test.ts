import { describe, expect, it } from "vitest";

import { collectMediaReferences } from "./media";
import type { BlockNode } from "./types";

const hero = (settings: Record<string, unknown>): BlockNode => ({
  _key: "hero1",
  _type: "heroCoverStar",
  settings: { headline: "Speed, considered", ...settings },
});

describe("collectMediaReferences", () => {
  it("finds media inside a group, and names the path the panel uses", () => {
    const refs = collectMediaReferences([
      hero({ media: { kind: "video", image: "/images/cover.jpg", videoUrl: "/video/cover.mp4" } }),
    ]);

    expect(refs).toEqual([
      {
        key: "hero1",
        type: "heroCoverStar",
        fieldPath: "media.image",
        kind: "image",
        url: "/images/cover.jpg",
      },
      {
        key: "hero1",
        type: "heroCoverStar",
        fieldPath: "media.videoUrl",
        kind: "video",
        url: "/video/cover.mp4",
      },
    ]);
  });

  it("indexes list items, so a usage points at one still and not the whole strip", () => {
    const refs = collectMediaReferences([
      {
        _key: "film1",
        _type: "filmStills",
        settings: {
          items: [
            { title: "One", still: "/images/one.jpg" },
            { title: "Two", still: "/images/two.jpg", videoUrl: "/video/two.mp4" },
          ],
        },
      },
    ]);

    expect(refs.map((r) => r.fieldPath)).toEqual([
      "items.0.still",
      "items.1.still",
      "items.1.videoUrl",
    ]);
  });

  it("descends into children", () => {
    const refs = collectMediaReferences([
      {
        _key: "parent",
        _type: "heroCoverStar",
        settings: { headline: "H" },
        children: [hero({ media: { image: "/images/nested.jpg" } })],
      },
    ]);

    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({ key: "hero1", url: "/images/nested.jpg" });
  });

  it("reads the legacy flat prop shape as well as `settings`", () => {
    // The seeded homepage spreads props at the top level; blockProps merges both.
    const refs = collectMediaReferences([
      {
        _key: "hero1",
        _type: "heroCoverStar",
        headline: "H",
        media: { image: "/images/flat.jpg" },
      },
    ]);

    expect(refs.map((r) => r.url)).toEqual(["/images/flat.jpg"]);
  });

  it("skips a bound list — its images belong to the entities the query returned", () => {
    const refs = collectMediaReferences([
      {
        _key: "film1",
        _type: "filmStills",
        settings: { items: { $bind: { source: "articles", limit: 3 } } },
      },
    ]);

    expect(refs).toEqual([]);
  });

  it("skips an unknown block type rather than guessing at its fields", () => {
    const refs = collectMediaReferences([
      { _key: "x", _type: "notARegisteredBlock", settings: { image: "/images/x.jpg" } },
    ]);

    expect(refs).toEqual([]);
  });

  it("ignores an empty value, so clearing a control drops the usage", () => {
    expect(collectMediaReferences([hero({ media: { image: "" } })])).toEqual([]);
  });

  it("does not collect `url` fields — a link is not an asset", () => {
    const refs = collectMediaReferences([
      {
        _key: "film1",
        _type: "filmStills",
        settings: { allHref: "/film", items: [{ title: "One" }] },
      },
    ]);

    expect(refs).toEqual([]);
  });

  it("returns nothing for an empty or missing tree", () => {
    expect(collectMediaReferences([])).toEqual([]);
    expect(collectMediaReferences(undefined)).toEqual([]);
  });

  it("reports the same asset twice when it is genuinely on the page twice", () => {
    // Two controls, two usages. The unique constraint is on the field path as
    // well as the asset, so both survive and removing one leaves the other.
    const refs = collectMediaReferences([
      hero({ media: { image: "/images/same.jpg", videoUrl: "" } }),
      {
        _key: "film1",
        _type: "filmStills",
        settings: { items: [{ title: "One", still: "/images/same.jpg" }] },
      },
    ]);

    expect(refs.map((r) => `${r.key}.${r.fieldPath}`)).toEqual([
      "hero1.media.image",
      "film1.items.0.still",
    ]);
  });
});
