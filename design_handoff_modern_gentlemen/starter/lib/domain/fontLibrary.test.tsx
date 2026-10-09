import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  FONT_LIBRARY,
  installedFontId,
  isFontValue,
  libraryFont,
  libraryFontStack,
  libraryFontStylesheet,
} from "./fontLibrary";
import { NativeText } from "@/components/elements/NativeElements";
import { normalizeBlock } from "@/lib/blocks/normalize";
import { manifestFor } from "@/lib/blocks/manifests";

describe("expanded font library", () => {
  it("includes a unique verified catalogue and retains every existing preset", () => {
    expect(FONT_LIBRARY.filter((font) => font.source === "google").length).toBeGreaterThan(1900);
    expect(new Set(FONT_LIBRARY.map((font) => font.value)).size).toBe(FONT_LIBRARY.length);
    expect(libraryFontStack("spaceGrotesk")).toContain("--font-space-grotesk");
    expect(libraryFontStack("theme:heading")).toBe("var(--font-heading)");
    for (const font of FONT_LIBRARY.filter((font) => font.source === "google")) {
      const url = new URL(libraryFontStylesheet(font.value)!);
      expect(url.origin).toBe("https://fonts.googleapis.com");
      expect(font.variants.split(",").every((v) => /^(?:[1-9][0-9]{0,2}|1000)i?$/.test(v))).toBe(
        true
      );
    }
  });
  it("loads only requested catalogue families and requests their available variants", () => {
    expect(libraryFontStylesheet("google:Lora")).toContain(
      "Lora:ital,wght@0,400;0,500;0,600;0,700;1,400"
    );
    expect(libraryFontStylesheet("systemSerif")).toBeUndefined();
    expect(libraryFontStylesheet("theme:body")).toBeUndefined();
    expect(libraryFontStylesheet("google:unlisted;family=Injected")).toBeUndefined();
    expect(libraryFont("google:unlisted")).toBeUndefined();
  });
  it("preserves catalogue selections through normalization and public rendering", () => {
    const settings = {
      content: "A considered life",
      fontFamily: "google:Lora",
      fontWeight: "500",
      fontStyle: "italic",
    };
    expect(manifestFor("nativeText")!.schema.safeParse(settings).success).toBe(true);
    expect(normalizeBlock({ _type: "nativeText", _key: "font", settings })).toMatchObject(settings);
    const html = renderToStaticMarkup(
      <>
        <NativeText {...settings} fontStyle="italic" />
        <NativeText content="Second" fontFamily="google:Lora" />
      </>
    );
    expect(html.match(/rel="stylesheet"/g)).toHaveLength(1);
    expect(html).toContain("font-weight:500");
    expect(html).toContain("font-style:italic");
    expect(html).not.toContain("Roboto");
  });
});

describe("installed fonts in the font library", () => {
  it("resolves an installed font through the variable the theme publishes", () => {
    expect(libraryFontStack("webfont:brand-serif")).toBe(
      "var(--mg-webfont-brand-serif,var(--font-body))"
    );
    expect(installedFontId("webfont:brand-serif")).toBe("brand-serif");
  });

  it("accepts library fonts and well-formed installed ids, nothing else", () => {
    expect(isFontValue("google:Lora")).toBe(true);
    expect(isFontValue("theme:heading")).toBe(true);
    expect(isFontValue("webfont:brand-serif")).toBe(true);
    for (const bad of ["webfont:", "webfont:Brand", "webfont:a;b", "webfont:x)}body{", "Lora"])
      expect(isFontValue(bad)).toBe(false);
    expect(libraryFontStack("webfont:x)}body{")).toBeUndefined();
  });
});
