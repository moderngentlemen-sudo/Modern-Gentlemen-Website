import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BlockVisibilityFrame, visibilityCss } from "./BlockVisibilityFrame";

describe("BlockVisibilityFrame", () => {
  it("adds no wrapper for a legacy block or an all-device block", () => {
    const child = <section>Content</section>;

    expect(
      renderToStaticMarkup(<BlockVisibilityFrame blockKey="a">{child}</BlockVisibilityFrame>)
    ).toBe("<section>Content</section>");
    expect(
      renderToStaticMarkup(
        <BlockVisibilityFrame
          blockKey="a"
          visibility={{ devices: ["desktop", "tablet", "mobile"] }}
        >
          {child}
        </BlockVisibilityFrame>
      )
    ).toBe("<section>Content</section>");
  });

  it("omits a globally hidden block from public output", () => {
    expect(
      renderToStaticMarkup(
        <BlockVisibilityFrame blockKey="a" visibility={{ hidden: true }}>
          <section>Secret</section>
        </BlockVisibilityFrame>
      )
    ).toBe("");
  });

  it("emits exact phone and tablet ranges from a closed device vocabulary", () => {
    const { css } = visibilityCss("responsive", ["mobile", "tablet"]);

    expect(css).toContain("@media(max-width:680px)");
    expect(css).toContain("@media(min-width:681px) and (max-width:1024px)");
    expect(css).not.toContain("min-width:1025px");
    expect(css).toContain("display:contents");
  });
});
