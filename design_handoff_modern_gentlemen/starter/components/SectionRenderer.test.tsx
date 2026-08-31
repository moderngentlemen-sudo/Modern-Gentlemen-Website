import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SectionRenderer } from "./SectionRenderer";

describe("SectionRenderer visibility", () => {
  const quote = {
    _key: "quote",
    _type: "pullQuote",
    quote: "A visible idea",
    attribution: "Modern Gentlemen",
  };

  it("omits a globally hidden section including its spacing wrapper", () => {
    const html = renderToStaticMarkup(
      <SectionRenderer
        sections={[
          {
            ...quote,
            visibility: { hidden: true },
            design: { spaceBefore: "xlarge", spaceAfter: "xlarge" },
          },
        ]}
      />
    );

    expect(html).toBe("");
  });

  it("keeps device targeting in the public render contract", () => {
    const html = renderToStaticMarkup(
      <SectionRenderer sections={[{ ...quote, visibility: { devices: ["mobile"] } }]} />
    );

    expect(html).toContain("data-mg-visibility-style");
    expect(html).toContain("@media(max-width:680px)");
    expect(html).not.toContain("min-width:1025px");
    expect(html).toContain("A visible idea");
  });
});
