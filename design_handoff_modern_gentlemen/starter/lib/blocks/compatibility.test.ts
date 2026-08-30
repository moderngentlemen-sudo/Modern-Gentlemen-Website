import { describe, expect, it } from "vitest";

import { registry } from "@/components/sections/registry";
import { manifestFor } from "./manifests";

/**
 * Every element type that existed when the builder-platform work began.
 *
 * Conformance proves the registry and manifests agree; this contract proves a
 * refactor did not make them agree by deleting both halves. Removing a type
 * from this list requires an explicit, tested content migration and a renderer
 * compatibility adapter — exactly the governing rule for the new system.
 */
const REPRODUCIBLE_BLOCK_TYPES = [
  "heroCoverStar",
  "latestGrid",
  "featureSplit",
  "twoUpCategory",
  "storyBand",
  "filmStills",
  "newsletter",
  "numberedIndex",
  "productRow",
  "statsBand",
  "interview",
  "timeline",
  "testimonials",
  "categoryHero",
  "featuredLead",
  "articleGrid",
  "ctaBand",
  "editorialHero",
  "manifesto",
  "coverCards",
  "pullQuote",
  "masthead",
  "columns",
  "column",
  "patternRef",
  "documentContent",
  "documentContentGap",
] as const;

describe("existing-site reproducibility contract", () => {
  it.each(REPRODUCIBLE_BLOCK_TYPES)("keeps %s renderable and authorable", (type) => {
    expect(registry[type]).toBeTypeOf("function");
    expect(manifestFor(type)).toBeDefined();
  });
});
