import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NativeHeading, NativeText } from "@/components/elements/NativeElements";
import { normalizeBlock } from "./normalize";
import { manifestFor } from "./manifests";
import { textTypographyStyle } from "./textTypography";

describe("builder text typography", () => {
  for (const type of ["nativeText", "nativeHeading"]) {
    const content = type === "nativeText" ? { content: "Text" } : { text: "Heading" };
    it(`${type} persists overrides through the public normalization path`, () => {
      const settings = {
        ...content,
        fontFamily: "systemSerif",
        fontSize: 27,
        textColor: "#123456",
      };
      expect(manifestFor(type)!.schema.safeParse(settings).success).toBe(true);
      expect(normalizeBlock({ _type: type, _key: "text", settings })).toMatchObject(settings);
    });
    it(`${type} rejects invalid fonts, sizes and CSS colour payloads`, () => {
      for (const invalid of [
        { fontFamily: "made-up" },
        { fontSize: 0 },
        { fontSize: Infinity },
        { fontSize: 241 },
        { textColor: "red;display:none" },
        { textColor: "#123" },
      ]) {
        expect(manifestFor(type)!.schema.safeParse({ ...content, ...invalid }).success).toBe(false);
      }
    });
  }
  it("leaves legacy text and headings without inline styles", () => {
    expect(renderToStaticMarkup(<NativeText content="Original" />)).not.toContain("style=");
    expect(renderToStaticMarkup(<NativeHeading text="Original" />)).not.toContain("style=");
    expect(textTypographyStyle({})).toBeUndefined();
  });
  it("renders overrides without losing semantic formatting", () => {
    const html = renderToStaticMarkup(
      <NativeText
        content={"## Title\n\n**Body**\n\n> Quote"}
        fontFamily="systemSerif"
        fontSize={27}
        textColor="#123456"
      />
    );
    expect(html).toContain("font-size:27px");
    expect(html).toContain("color:#123456");
    expect(html.match(/font-family:/g)).toHaveLength(3);
    expect(html).toContain("<strong>Body</strong>");
    const heading = renderToStaticMarkup(
      <NativeHeading text="Title" level="h3" fontSize={35} textColor="#654321" />
    );
    expect(heading).toMatch(/^<h3/);
    expect(heading).toContain("font-size:35px;color:#654321");
  });
});
