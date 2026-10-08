import { describe, expect, it } from "vitest";

import { newBlockNode } from "./node";
import { blockLabel, blockSnippet, describeStep } from "./history";

describe("describeStep", () => {
  const heading = newBlockNode("nativeHeading");
  const text = newBlockNode("nativeText");
  const image = newBlockNode("nativeImage");

  it("names a single addition and points at it", () => {
    expect(describeStep([heading], [heading, text])).toEqual({
      label: "Added Text",
      key: text._key,
    });
  });

  it("counts several additions", () => {
    expect(describeStep([], [heading, text]).label).toBe("Added 2 blocks");
  });

  it("names a removal without pointing at a block that is gone", () => {
    expect(describeStep([heading, text], [heading])).toEqual({ label: "Removed Text", key: null });
  });

  it("finds the block that travelled, not every sibling it passed", () => {
    expect(describeStep([heading, text, image], [text, image, heading])).toEqual({
      label: "Moved Heading",
      key: heading._key,
    });
  });

  it("calls a settings change an edit, and recognises lock and hide", () => {
    const edited = { ...text, settings: { ...text.settings, content: "New copy" } };
    expect(describeStep([text], [edited]).label).toBe("Edited Text");
    expect(describeStep([text], [{ ...text, locked: true }]).label).toBe("Locked Text");
    expect(describeStep([text], [{ ...text, visibility: { hidden: true } }]).label).toBe(
      "Hid Text"
    );
  });

  it("reports an addition inside a container as the addition alone", () => {
    const columns = newBlockNode("columns");
    const filled = { ...columns, children: [...(columns.children ?? []), text] };
    expect(describeStep([columns], [filled]).label).toBe("Added Text");
  });

  it("falls back to page settings when no block changed", () => {
    expect(describeStep([heading], [heading]).label).toBe("Changed page settings");
  });
});

describe("block naming", () => {
  it("prefers the editor's own layer name", () => {
    const text = newBlockNode("nativeText");
    expect(blockLabel(text)).toBe("Text");
    expect(blockLabel({ ...text, visual: { name: "Intro" } })).toBe("Intro");
  });

  it("quotes a short, unformatted piece of the block's copy", () => {
    const text = newBlockNode("nativeText");
    const long = { ...text, settings: { content: "**Hello** there, " + "word ".repeat(30) } };
    const snippet = blockSnippet(long, 20)!;
    expect(snippet.startsWith("Hello there")).toBe(true);
    expect(snippet.length).toBe(20);
    expect(blockSnippet({ ...text, settings: {} })).toBeNull();
  });
});
