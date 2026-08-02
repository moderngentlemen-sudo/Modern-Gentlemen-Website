/**
 * The manifests must describe the homepage that actually ships, not an
 * idealised one. `DEMO_SECTIONS` is the layout the live site renders and the
 * one `scripts/seed.ts` lifted verbatim into `pages.published_data`, so it is
 * the honest fixture.
 *
 * The second test is the render-safety guarantee in miniature: normalizing a
 * block must not add or remove a single prop on content that is already
 * complete. Adding a prop would change what the component receives; the
 * byte-diff of the prerendered HTML is the wider version of this check.
 */

import { describe, expect, it } from "vitest";

import { DEMO_SECTIONS } from "@/lib/demo/home-sections";
import { blockProps, normalizeBlock } from "./normalize";
import { flattenBlocks } from "./traverse";
import { formatIssues, validateTree } from "./validate";
import type { BlockNode } from "./types";

const tree = DEMO_SECTIONS as unknown as BlockNode[];

describe("the seeded homepage", () => {
  it("passes strict validation", () => {
    const result = validateTree(tree);
    expect(result.ok, `\n${formatIssues(result.issues)}`).toBe(true);
  });

  it("has a manifest for all seven of its sections", () => {
    expect(flattenBlocks(tree)).toHaveLength(7);
  });

  it.each(tree.map((node) => [node._type, node] as const))(
    "%s survives normalization with its prop set unchanged",
    (_type, node) => {
      const before = Object.keys(blockProps(node)).sort();
      const after = Object.keys(normalizeBlock(node)).sort();
      expect(after).toEqual(before);
    }
  );
});
