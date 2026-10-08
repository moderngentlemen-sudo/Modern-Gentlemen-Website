import { describe, expect, it } from "vitest";

import { adviseTree } from "./advisories";
import { newBlockNode } from "./node";

const heading = (level: string) => {
  const node = newBlockNode("nativeHeading");
  return { ...node, settings: { ...node.settings, text: "Title", level } };
};

describe("adviseTree", () => {
  it("is quiet for a clean outline", () => {
    expect(adviseTree([heading("h1"), heading("h2"), heading("h3")])).toEqual([]);
  });

  it("flags a second H1 and a skipped level, each with a fix", () => {
    const advice = adviseTree([heading("h1"), heading("h1"), heading("h4")]);
    expect(advice.map((a) => a.fix)).toEqual([
      { kind: "setHeadingLevel", level: "h2", label: "Make it H2" },
      { kind: "setHeadingLevel", level: "h2", label: "Make it H2" },
    ]);
  });

  it("flags a block shown on no device, and a hidden one", () => {
    const text = newBlockNode("nativeText");
    expect(adviseTree([{ ...text, visibility: { devices: [] } }])[0].fix?.kind).toBe(
      "showOnAllDevices"
    );
    expect(adviseTree([{ ...text, visibility: { hidden: true } }])[0].fix?.kind).toBe("unhide");
  });

  it("asks for alt text on an image that has a source", () => {
    const image = newBlockNode("nativeImage");
    const withSrc = { ...image, settings: { ...image.settings, src: "/a.jpg", alt: "" } };
    expect(adviseTree([withSrc])[0].message).toMatch(/alternative text/);
    expect(adviseTree([{ ...withSrc, settings: { ...withSrc.settings, alt: "A coat" } }])).toEqual(
      []
    );
  });

  it("offers to remove an empty grid", () => {
    const grid = { ...newBlockNode("gridLayout"), children: [] };
    expect(adviseTree([grid])[0].fix?.kind).toBe("remove");
  });
});
