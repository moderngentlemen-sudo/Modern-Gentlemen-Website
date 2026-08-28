import { describe, expect, it } from "vitest";

import { staleUsageIds, tsQuery } from "./media";

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

/**
 * The search box's input, on its way to `to_tsquery`.
 *
 * ⚠️ This is a 500-prevention test, not a relevance one. Postgres **raises** on
 * a malformed tsquery rather than returning nothing, so a stray `&` typed into
 * the media library's search field would be an error page, not an empty result.
 * Stripping every operator is what makes malformed input unrepresentable.
 */
describe("tsQuery", () => {
  it("ANDs the words and makes each one a prefix", () => {
    // Prefixes because the field filters as an editor types: "hero ban" has to
    // find "hero banner" before they have finished the word.
    expect(tsQuery("hero banner")).toBe("hero:* & banner:*");
  });

  it("strips every to_tsquery operator", () => {
    for (const term of ["a & b", "a | b", "!a", "a <-> b", "(a)", "a:b", "a'b", "a:*"]) {
      const query = tsQuery(term);
      expect(query, term).not.toBeNull();
      // The only `:` and `*` left are the prefix markers this function adds.
      expect(query!.replace(/:\*/g, ""), term).toMatch(/^[\p{L}\p{N}]+( & [\p{L}\p{N}]+)*$/u);
    }
  });

  it("keeps letters outside ASCII, which filenames and titles carry", () => {
    expect(tsQuery("café")).toBe("café:*");
    expect(tsQuery("2024")).toBe("2024:*");
  });

  it("returns null when nothing survives, rather than an empty query", () => {
    // `to_tsquery('')` is itself a syntax error, so the caller has to be told to
    // skip the full-text query entirely — which drops it onto the substring
    // fallback, where punctuation is a legitimate thing to search for.
    expect(tsQuery("---")).toBeNull();
    expect(tsQuery("   ")).toBeNull();
    expect(tsQuery("")).toBeNull();
  });

  it("caps the number of words", () => {
    // A pasted paragraph should not become a hundred-clause tsquery.
    expect(tsQuery("a b c d e f g h i j k")!.split(" & ")).toHaveLength(8);
  });
});
