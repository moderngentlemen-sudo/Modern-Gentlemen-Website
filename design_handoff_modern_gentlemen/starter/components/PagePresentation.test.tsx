import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PagePresentation } from "./PagePresentation";

describe("page presentation", () => {
  it("preserves legacy DOM and SEO-only pages", () => {
    expect(
      renderToStaticMarkup(
        <PagePresentation>
          <h1>Original</h1>
        </PagePresentation>
      )
    ).toBe("<h1>Original</h1>");
    expect(
      renderToStaticMarkup(
        <PagePresentation settings={{ seoTitle: "SEO" }}>
          <h1>Original</h1>
        </PagePresentation>
      )
    ).toBe("<h1>Original</h1>");
  });
  it("does not load a video before checking motion and device preferences", () => {
    const html = renderToStaticMarkup(
      <PagePresentation
        settings={{
          backgroundVideo: "https://example.com/video.mp4",
          backgroundImage: "/poster.jpg",
        }}
      >
        Content
      </PagePresentation>
    );
    expect(html).not.toContain("<video");
    expect(html).toContain("poster.jpg");
  });
  it("scopes editor presentation independently of site chrome", () => {
    const html = renderToStaticMarkup(
      <PagePresentation preview settings={{ header: "hidden", mobileHeader: "inherit" }}>
        Content
      </PagePresentation>
    );
    expect(html).toContain('data-page-presentation="preview"');
    expect(html).toContain('data-page-mobile-header="inherit"');
  });
});
