import { describe, expect, it } from "vitest";

import { blockTreeToEngine, engineToBlockTree } from "./engine";
import type { BlockTree } from "./types";

describe("builder engine compatibility adapter", () => {
  it("round-trips legacy props, nested blocks and new visual settings losslessly", () => {
    const tree: BlockTree = [
      {
        _key: "legacy-hero",
        _type: "heroCoverStar",
        eyebrow: "Legacy flat field",
        settings: { headline: "Modern Gentlemen" },
        visibility: { devices: ["desktop", "mobile"] },
        design: { spaceAfter: "large" },
        visual: {
          styles: {
            desktop: { display: "grid", gap: 24 },
            mobile: { display: "block", paddingX: 16 },
          },
          effects: { hover: "lift", motion: "gentle" },
        },
        locked: true,
        children: [
          {
            _key: "nested",
            _type: "latestGrid",
            settings: { title: "Latest" },
          },
        ],
      },
    ];

    expect(engineToBlockTree(blockTreeToEngine(tree))).toEqual(tree);
  });

  it("gives every normalized element a stable component identity", () => {
    const document = blockTreeToEngine([{ _key: "a", _type: "ctaBand" }]);

    expect(document).toMatchObject({
      engineVersion: 1,
      elements: [{ id: "a", kind: "component", component: "ctaBand" }],
    });
  });
});
