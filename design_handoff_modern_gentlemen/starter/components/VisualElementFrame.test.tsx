import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { VisualElementFrame } from "./VisualElementFrame";

describe("VisualElementFrame", () => {
  it("preserves legacy markup when no visual settings are present", () => {
    const html = renderToStaticMarkup(
      <VisualElementFrame blockKey="legacy">
        <section id="original">Content</section>
      </VisualElementFrame>
    );

    expect(html).toBe('<section id="original">Content</section>');
  });

  it("adds one scoped frame only when the element is customized", () => {
    const html = renderToStaticMarkup(
      <VisualElementFrame
        blockKey="custom"
        visual={{ styles: { desktop: { paddingX: 24 } }, effects: { hover: "scale" } }}
      >
        <section>Content</section>
      </VisualElementFrame>
    );

    expect(html).toContain("data-mg-visual-style");
    expect(html).toContain("data-mg-visual=");
    expect(html).toContain('data-mg-reveal=""');
    expect(html).toContain("padding-left:24px");
    expect(html.match(/<section/g)).toHaveLength(1);
  });

  it("applies a reusable class without emitting redundant local CSS", () => {
    const html = renderToStaticMarkup(
      <VisualElementFrame blockKey="classed" visual={{ styleClass: "feature-card" }}>
        <section>Content</section>
      </VisualElementFrame>
    );

    expect(html).toContain('data-mg-style="feature-card"');
    expect(html).toContain('data-mg-reveal=""');
    expect(html).not.toContain("data-mg-visual-style");
  });
});
