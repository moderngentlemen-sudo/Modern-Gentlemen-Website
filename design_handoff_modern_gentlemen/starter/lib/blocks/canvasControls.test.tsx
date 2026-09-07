import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { gradientSchema, gradientCss } from "../domain/gradient";
import { readPageSettings } from "../domain/pageSettings";
import { mediaAppearanceStyle } from "./mediaAppearance";
import { BlockDesignFrame } from "@/components/BlockDesignFrame";
import { NativeButton, NativeImage, NativeDivider } from "@/components/elements/NativeElements";
import { normalizeBlock } from "./normalize";
import { validateBlock } from "./validate";
describe("canvas presentation controls", () => {
  const gradient = {
    angle: 90,
    stops: [
      { color: "#111111", position: 100 },
      { color: "#ffffff", position: 0 },
    ],
  };
  it("validates gradients and sorts a copy without changing saved stop order", () => {
    expect(gradientCss(gradient)).toBe("linear-gradient(90deg, #ffffff 0%, #111111 100%)");
    expect(gradient.stops[0].position).toBe(100);
    for (const invalid of [
      { ...gradient, angle: Infinity },
      { ...gradient, stops: [] },
      { ...gradient, stops: [{ color: "url(evil)", position: 0 }, gradient.stops[0]] },
    ])
      expect(gradientSchema.safeParse(invalid).success).toBe(false);
    expect(readPageSettings({ backgroundGradient: gradient }).backgroundGradient).toEqual(gradient);
    expect(
      readPageSettings({ backgroundGradient: { angle: -1 } }).backgroundGradient
    ).toBeUndefined();
  });
  it("preserves legacy wrappers and renders optional section gradients", () => {
    expect(
      renderToStaticMarkup(
        <BlockDesignFrame>
          <p>Original</p>
        </BlockDesignFrame>
      )
    ).toBe("<p>Original</p>");
    expect(
      renderToStaticMarkup(
        <BlockDesignFrame design={{ gradient }}>
          <p>Original</p>
        </BlockDesignFrame>
      )
    ).toContain("linear-gradient");
    expect(
      validateBlock({
        _key: "a",
        _type: "nativeText",
        settings: { content: "Text" },
        design: { gradient },
      }).ok
    ).toBe(true);
  });
  it("persists media controls and rejects invalid appearance values", () => {
    const settings = {
      src: "/image.jpg",
      appearance: { brightness: 120, focalX: 20 },
      captionTypography: { fontSize: 20 },
    };
    expect(normalizeBlock({ _key: "a", _type: "nativeImage", settings })).toMatchObject(settings);
    expect(mediaAppearanceStyle({ brightness: Infinity })).toBeUndefined();
    expect(mediaAppearanceStyle({ brightness: 120, focalX: 20 })).toMatchObject({
      filter: "brightness(120%)",
      objectPosition: "20% 50%",
    });
    expect(renderToStaticMarkup(<NativeImage {...settings} caption="Caption" />)).toContain(
      "font-size:20px"
    );
  });
  it("renders button text and exact divider thickness without changing absent defaults", () => {
    expect(
      renderToStaticMarkup(<NativeButton label="Go" href="/" typography={{ fontSize: 22 }} />)
    ).toContain("font-size:22px");
    expect(renderToStaticMarkup(<NativeDivider thickness={7} color="#123456" />)).toContain(
      "border-top-width:7px"
    );
    expect(renderToStaticMarkup(<NativeDivider />)).not.toContain("style=");
  });
});
