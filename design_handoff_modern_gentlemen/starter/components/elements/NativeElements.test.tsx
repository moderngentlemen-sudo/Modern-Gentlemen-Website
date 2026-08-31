import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  NativeButton,
  NativeHeading,
  NativeImage,
  NativeSpacer,
  NativeText,
} from "./NativeElements";

describe("native builder elements", () => {
  it("keeps heading semantics separate from visual size", () => {
    const html = renderToStaticMarkup(
      <NativeHeading text="A semantic heading" level="h3" size="display" />
    );

    expect(html).toMatch(/^<h3/);
    expect(html).toContain("text-[52px]");
  });

  it("renders multiline text as one accessible paragraph", () => {
    const html = renderToStaticMarkup(<NativeText content={"First line\nSecond line"} />);

    expect(html).toContain("<p");
    expect(html.match(/<p/g)).toHaveLength(1);
    expect(html).toContain("First line\nSecond line");
  });

  it("protects new-tab links from opener access", () => {
    const html = renderToStaticMarkup(
      <NativeButton label="Merchant" href="https://example.com" newTab />
    );

    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("keeps author-supplied alternative text on lazy images", () => {
    const html = renderToStaticMarkup(
      <NativeImage src="/editorial.jpg" alt="A tailored dinner jacket" aspect="portrait" />
    );

    expect(html).toContain('alt="A tailored dinner jacket"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain("aspect-[3/4]");
  });

  it("stores all three spacer heights as bounded CSS variables", () => {
    const html = renderToStaticMarkup(<NativeSpacer desktop={96} tablet={64} mobile={32} />);

    expect(html).toContain("--mg-spacer-desktop:96px");
    expect(html).toContain("--mg-spacer-tablet:64px");
    expect(html).toContain("--mg-spacer-mobile:32px");
    expect(html).toContain('aria-hidden="true"');
  });
});
