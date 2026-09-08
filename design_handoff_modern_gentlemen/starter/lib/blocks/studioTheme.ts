import { studioColor } from "./studioPublishing";

// Only Studio's standard neutral palette follows the site theme. Arbitrary
// brand colors and photographs are authored content, not candidates for inversion.
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
  if (!hex || !neutrals.has(hex.slice(0, 6))) return color;
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
  return (
    !!hex &&
    ["ffffff", "f4f4f4", "f8f7f3", "dfd9ce"].includes(hex.slice(0, 6)) &&
    (hex.length === 6 || hex.slice(6) === "ff")
  );
}
export function studioFixedFill(value: unknown) {
  const hex = channels(value);
  return !!hex && !neutrals.has(hex.slice(0, 6)) && (hex.length === 6 || hex.slice(6) === "ff");
}

// Accent text needs the brighter dark-theme ink; accent fills stay racing red.
export function studioThemeInk(value: unknown): string | undefined {
  return channels(value) === "c8102e" || channels(value) === "c8102eff"
    ? "var(--studio-accent-ink, #c8102e)"
    : studioThemeColor(value);
}
