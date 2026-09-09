import { describe, it, expect } from "vitest";
import { DEFAULT_MEDIA_OVERLAY, mediaOverlaySchema, mediaOverlayStyle } from "./mediaOverlay";
import {
  DEFAULT_THEME_HEADER,
  HEADER_ENTRY_ANIMATIONS,
  parseThemeHeader,
  themeHeaderSchema,
} from "./theme";
import { HEADER_ENTRY_FRAMES, headerSurface, lightHeaderBackground } from "./headerAppearance";

describe("Header appearance and media overlays", () => {
  it("keeps old frosted headers and adds a separate solid fill with fractional opacity", () => {
    expect(headerSurface(DEFAULT_THEME_HEADER, true)).toEqual({
      background: "rgba(13,13,13,0.55)",
      backdropFilter: "blur(20px)",
    });
    const header = parseThemeHeader({
      header: {
        background: "filled",
        fillColor: "#eeddcc",
        fillOpacity: 72.5,
        frostBlur: 0,
        autoContrast: true,
      },
    });
    expect(themeHeaderSchema.safeParse(header).success).toBe(true);
    expect(headerSurface(header, false)).toEqual({
      background: "color-mix(in srgb, #eeddcc 72.5%, transparent)",
      backdropFilter: "blur(0px)",
    });
    expect(lightHeaderBackground([240, 235, 220])).toBe(true);
    expect(lightHeaderBackground([20, 20, 20])).toBe(false);
  });
  it("rejects unsafe colors and out-of-range header effects without losing valid legacy settings", () => {
    const read = parseThemeHeader({
      header: {
        height: 80,
        fillColor: "red;display:none",
        fillOpacity: 101,
        entryAnimation: "custom",
      },
    });
    expect(read).toMatchObject({
      height: 80,
      fillColor: DEFAULT_THEME_HEADER.fillColor,
      fillOpacity: 100,
      entryAnimation: "none",
    });
    expect(themeHeaderSchema.safeParse({ ...DEFAULT_THEME_HEADER, fillOpacity: 101 }).success).toBe(
      false
    );
    expect(HEADER_ENTRY_ANIMATIONS.filter((a) => a !== "none").length).toBeGreaterThanOrEqual(10);
    for (const a of HEADER_ENTRY_ANIMATIONS.filter((a) => a !== "none"))
      expect(HEADER_ENTRY_FRAMES[a].length).toBeGreaterThan(1);
  });
  it("preserves transparent stops and radial placement while keeping overlays absent by default", () => {
    expect(mediaOverlayStyle(undefined)).toBeUndefined();
    expect(mediaOverlayStyle(DEFAULT_MEDIA_OVERLAY)).toBeUndefined();
    expect(
      mediaOverlayStyle({
        ...DEFAULT_MEDIA_OVERLAY,
        mode: "radial",
        color: "#c8102e",
        x: 25,
        y: 75,
        opacity: 32.5,
      })
    ).toEqual({
      background: "radial-gradient(ellipse at 25% 75%, #c8102e 0%, #00000000 100%)",
      opacity: 0.325,
    });
    for (const patch of [
      { opacity: 101 },
      { start: 80, end: 20 },
      { color: "url(https://example.test)" },
      { angle: Infinity },
    ])
      expect(mediaOverlaySchema.safeParse({ ...DEFAULT_MEDIA_OVERLAY, ...patch }).success).toBe(
        false
      );
  });
});
