import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BlockDesignFrame } from "./BlockDesignFrame";

describe("BlockDesignFrame", () => {
  it("adds no DOM when a section has no design overrides", () => {
    const { container } = render(
      <BlockDesignFrame>
        <section data-section="" />
      </BlockDesignFrame>
    );

    expect(container.children).toHaveLength(1);
    expect(container.firstElementChild?.tagName).toBe("SECTION");
  });

  it("wraps a section with bounded outer spacing when requested", () => {
    const { container } = render(
      <BlockDesignFrame design={{ spaceBefore: "small", spaceAfter: "xlarge" }}>
        <section />
      </BlockDesignFrame>
    );

    expect(container.firstElementChild).toHaveStyle({
      paddingTop: "24px",
      paddingBottom: "120px",
    });
  });

  it("ignores malformed stored spacing on the forgiving render path", () => {
    const { container } = render(
      <BlockDesignFrame design={{ spaceBefore: "huge" } as never}>
        <section />
      </BlockDesignFrame>
    );

    expect(container.firstElementChild?.tagName).toBe("SECTION");
  });
});
