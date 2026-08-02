import { describe, expect, it } from "vitest";

import { staleUsageIds } from "./media";

/**
 * The one piece of logic in usage reconciliation that is not I/O.
 *
 * Everything else in `replaceUsagesForEntity` is an upsert and a delete; this
 * decides *what* the delete removes, and getting it wrong strands an asset in a
 * permanently-in-use state that no editor can clear.
 */
const row = (id: string, assetId: string, fieldPath: string | null) => ({
  id,
  asset_id: assetId,
  field_path: fieldPath,
});

describe("staleUsageIds", () => {
  it("keeps a row the save still wants", () => {
    const existing = [row("r1", "a1", "sections.hero1.media.image")];
    const wanted = [{ assetId: "a1", fieldPath: "sections.hero1.media.image" }];

    expect(staleUsageIds(existing, wanted)).toEqual([]);
  });

  it("removes a row for a reference the save dropped", () => {
    const existing = [row("r1", "a1", "sections.hero1.media.image")];

    expect(staleUsageIds(existing, [])).toEqual(["r1"]);
  });

  it("removes the old asset when a control's image is swapped for another", () => {
    // The field path is unchanged; only the asset moved. A path-only comparison
    // would keep r1 and report a1 as still in use — the failure this pairing
    // exists to prevent.
    const existing = [row("r1", "a1", "sections.hero1.media.image")];
    const wanted = [{ assetId: "a2", fieldPath: "sections.hero1.media.image" }];

    expect(staleUsageIds(existing, wanted)).toEqual(["r1"]);
  });

  it("keeps both rows when one asset is used at two paths", () => {
    const existing = [
      row("r1", "a1", "sections.hero1.media.image"),
      row("r2", "a1", "sections.film1.items.0.still"),
    ];
    const wanted = [
      { assetId: "a1", fieldPath: "sections.hero1.media.image" },
      { assetId: "a1", fieldPath: "sections.film1.items.0.still" },
    ];

    expect(staleUsageIds(existing, wanted)).toEqual([]);
  });

  it("removes only the reference that went away", () => {
    const existing = [
      row("r1", "a1", "sections.hero1.media.image"),
      row("r2", "a1", "sections.film1.items.0.still"),
    ];
    const wanted = [{ assetId: "a1", fieldPath: "sections.hero1.media.image" }];

    expect(staleUsageIds(existing, wanted)).toEqual(["r2"]);
  });

  it("treats a null field path as the empty path rather than matching everything", () => {
    // `field_path` is nullable in the schema though this code always writes a
    // string. A null must not accidentally compare equal to a real path.
    const existing = [row("r1", "a1", null)];
    const wanted = [{ assetId: "a1", fieldPath: "sections.hero1.media.image" }];

    expect(staleUsageIds(existing, wanted)).toEqual(["r1"]);
  });

  it("is a no-op against an entity that had no usages", () => {
    expect(staleUsageIds([], [{ assetId: "a1", fieldPath: "x" }])).toEqual([]);
  });
});
