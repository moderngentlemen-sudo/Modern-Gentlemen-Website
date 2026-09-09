import type { ThemeHeader } from "./theme";

export function headerSurface(settings: ThemeHeader, frosted: boolean) {
  const filled = settings.background === "filled";
  return {
    background: filled
      ? `color-mix(in srgb, ${settings.fillColor} ${settings.fillOpacity}%, transparent)`
      : frosted
        ? "rgba(13,13,13,0.55)"
        : "transparent",
    backdropFilter:
      filled || frosted
        ? `blur(${settings.frostBlur}px)${settings.frostSaturation === 100 ? "" : ` saturate(${settings.frostSaturation}%)`}`
        : "none",
  };
}

export const HEADER_ENTRY_FRAMES: Record<ThemeHeader["entryAnimation"], Keyframe[]> = {
  none: [],
  fade: [{ opacity: 0 }, { opacity: 1 }],
  "slide-down": [
    { opacity: 0, translate: "0 -100%" },
    { opacity: 1, translate: "0 0" },
  ],
  rise: [
    { opacity: 0, translate: "0 32px" },
    { opacity: 1, translate: "0 0" },
  ],
  "slide-left": [
    { opacity: 0, translate: "-64px 0" },
    { opacity: 1, translate: "0 0" },
  ],
  "slide-right": [
    { opacity: 0, translate: "64px 0" },
    { opacity: 1, translate: "0 0" },
  ],
  "zoom-in": [
    { opacity: 0, scale: "0.92" },
    { opacity: 1, scale: "1" },
  ],
  "zoom-out": [
    { opacity: 0, scale: "1.08" },
    { opacity: 1, scale: "1" },
  ],
  blur: [
    { opacity: 0, filter: "blur(12px)" },
    { opacity: 1, filter: "blur(0)" },
  ],
  "reveal-down": [{ clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0)" }],
  "reveal-center": [{ clipPath: "inset(0 50%)" }, { clipPath: "inset(0)" }],
  tilt: [
    { opacity: 0, rotate: "-2deg", translate: "0 -20px" },
    { opacity: 1, rotate: "0deg", translate: "0 0" },
  ],
  settle: [
    { opacity: 0, translate: "0 -50px" },
    { opacity: 1, translate: "0 5px", offset: 0.75 },
    { opacity: 1, translate: "0 0" },
  ],
};

export function lightHeaderBackground(rgb: number[]): boolean {
  const c = rgb.map((v) => {
    const n = v / 255;
    return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  });
  // The luminance where dark ink has more contrast than light ink.
  return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722 > 0.179;
}
