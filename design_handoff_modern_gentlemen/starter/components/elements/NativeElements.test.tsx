import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  NativeButton,
  NativeEmbed,
  NativeHeading,
  NativeImage,
  NativeIcon,
  NativeSpacer,
  NativeText,
} from "./NativeElements";
import { NativeVideo } from "./NativeVideo";

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
    expect(html).toContain("mg-button");
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

  it("normalizes a supported embed and rejects an arbitrary iframe host", () => {
    expect(renderToStaticMarkup(<NativeEmbed url="https://youtu.be/abc" title="Film" />)).toContain(
      'src="https://www.youtube-nocookie.com/embed/abc"'
    );
    expect(renderToStaticMarkup(<NativeEmbed url="https://example.com/embed" title="No" />)).toBe(
      ""
    );
  });

  it("keeps decorative icons out of the accessibility tree", () => {
    const decorative = renderToStaticMarkup(<NativeIcon icon="star" />);
    const labelled = renderToStaticMarkup(<NativeIcon icon="star" label="Featured" />);
    expect(decorative).toContain('aria-hidden="true"');
    expect(labelled).toContain('aria-label="Featured"');
    expect(labelled).toContain('role="img"');
  });

  it("renders video playback choices without forcing a download", () => {
    const html = renderToStaticMarkup(
      <NativeVideo src="/film.mp4" poster="/poster.jpg" aspect="cinema" controls loop />
    );
    expect(html).toContain('preload="metadata"');
    expect(html).toContain('poster="/poster.jpg"');
    expect(html).toContain("aspect-[21/9]");
    expect(html).toContain("controls");
    expect(html).toContain("loop");
  });
});
