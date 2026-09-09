import { studioColor, studioGradient } from "./studioValues";

// Known template neutrals retain the published theme tokens. Custom colors use
// a hue-preserving dark companion, scoped to adaptive sections.
const neutrals = new Set([
  "ffffff",
  "f4f4f4",
  "141414",
  "000000",
  "0d0d0d",
  "5a5a5a",
  "707070",
  "f8f7f3",
  "dfd9ce",
  "645f56",
  "8b857b",
]);
function channels(value: unknown) {
  const color = studioColor(value);
  if (!color || color === "transparent") return undefined;
  const hex = color.slice(1).toLowerCase();
  return hex.length <= 4 ? [...hex].map((digit) => digit + digit).join("") : hex;
}
export function studioThemeColor(value: unknown): string | undefined {
  const color = studioColor(value),
    hex = channels(value);
  if (!hex) return color;
  if (!neutrals.has(hex.slice(0, 6)))
    return luminance(hex) > 0.18 ? customThemeColor(value, "surface") : color;
  const base = hex.slice(0, 6),
    alpha = hex.length === 8 ? parseInt(hex.slice(6), 16) : 255;
  if (alpha === 0) return color;
  const themed = `var(--studio-${base}, #${base})`;
  return alpha === 255
    ? themed
    : `color-mix(in srgb, ${themed} ${(alpha / 255) * 100}%, transparent)`;
}
export function studioAdaptiveSurface(value: unknown) {
  const hex = channels(value);
  return value === "transparent" || (!!hex && (hex.slice(6) === "00" || luminance(hex) > 0.18));
}
export function studioFixedFill(value: unknown) {
  const hex = channels(value);
  return (
    !!hex &&
    !neutrals.has(hex.slice(0, 6)) &&
    luminance(hex) <= 0.18 &&
    (hex.length === 6 || hex.slice(6) === "ff")
  );
}

// Accent text needs the brighter dark-theme ink; accent fills stay racing red.
export function studioThemeInk(value: unknown): string | undefined {
  return channels(value) === "c8102e" || channels(value) === "c8102eff"
    ? "var(--studio-accent-ink, #c8102e)"
    : channels(value) && !neutrals.has(channels(value)!.slice(0, 6))
      ? customThemeColor(value, "ink")
      : studioThemeColor(value);
}

function rgb(hex: string) {
  return [0, 2, 4].map((start) => parseInt(hex.slice(start, start + 2), 16));
}
function luminance(hex: string) {
  const linear = rgb(hex).map((value) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}
const toHex = (values: number[]) =>
  values.map((value) => Math.round(value).toString(16).padStart(2, "0")).join("");

/** Preserve hue and alpha. Surface RGBs scale toward black; ink blends toward
 * white until its opaque luminance clears 0.45. Author-selected opacity remains. */
export function studioDarkColor(value: unknown, role: "surface" | "ink") {
  const hex = channels(value);
  if (!hex) return studioColor(value);
  const original = rgb(hex);
  let result = hex.slice(0, 6);
  if (role === "surface") result = toHex(original.map((channel) => channel * 0.14));
  else {
    for (let step = 1; step <= 100 && luminance(result) < 0.45; step++)
      result = toHex(original.map((channel) => channel + ((255 - channel) * step) / 100));
  }
  return `#${result}${hex.slice(6)}`;
}
function customThemeColor(value: unknown, role: "surface" | "ink") {
  const color = studioColor(value),
    hex = channels(value);
  if (!hex || hex.slice(6) === "00") return color;
  const dark = studioDarkColor(value, role);
  if (dark === `#${hex}`) return color;
  return `color-mix(in srgb, ${dark} var(--studio-dark-weight, 0%), ${color})`;
}
export function studioAdaptiveGradient(value: unknown) {
  const gradient = studioGradient(value);
  return (
    !!gradient &&
    (gradient.match(/#[\da-f]{3,8}/gi) || []).some((color) => studioAdaptiveSurface(color))
  );
}
export function studioThemeGradient(value: unknown) {
  const gradient = studioGradient(value);
  return gradient?.replace(/#[\da-f]{3,8}/gi, (color) => customThemeColor(color, "surface")!);
}
