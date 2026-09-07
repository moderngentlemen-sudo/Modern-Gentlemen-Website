import snapshot from "./googleFonts.json";
import { FONT_PRESET_OPTIONS, fontStackForSelection, type FontPreset } from "./theme";

const THEME_FONTS: Record<string, string> = {
  "theme:heading": "var(--font-heading)",
  "theme:body": "var(--font-body)",
  "theme:editorial": "var(--font-editorial)",
  "theme:label": "var(--font-label)",
  "theme:navigation": "var(--font-navigation)",
};

export const FONT_LIBRARY = [
  ...Object.keys(THEME_FONTS).map((value) => ({
    value,
    label: `Theme ${value.slice(6)} font`,
    category: "Theme fonts",
    variants: "",
    source: "theme",
  })),
  ...FONT_PRESET_OPTIONS.map((font) => ({
    ...font,
    category: "MG favourites",
    variants: "",
    source: "builtin",
  })),
  ...snapshot.families.map(([family, category, variants]) => ({
    value: `google:${family}`,
    label: family,
    category,
    variants,
    source: "google",
  })),
];
const byId = new Map(FONT_LIBRARY.map((font) => [font.value, font]));
export const libraryFont = (value: string | undefined) => (value ? byId.get(value) : undefined);
export function libraryFontStack(value: string | undefined): string | undefined {
  const font = libraryFont(value);
  if (!font) return undefined;
  if (font.source === "theme") return THEME_FONTS[font.value];
  if (font.source === "builtin") return fontStackForSelection(font.value as FontPreset, []);
  const fallback =
    font.category === "Serif"
      ? "serif"
      : font.category === "Monospace"
        ? "monospace"
        : "sans-serif";
  return `${JSON.stringify(font.label)},${fallback}`;
}
export function libraryFontStylesheet(value: string | undefined): string | undefined {
  const font = libraryFont(value);
  if (!font || font.source !== "google") return undefined;
  const variants = font.variants
    .split(",")
    .map((v) => `${v.endsWith("i") ? 1 : 0},${parseInt(v, 10)}`);
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font.label)}:ital,wght@${variants.join(";")}&display=swap`;
}
