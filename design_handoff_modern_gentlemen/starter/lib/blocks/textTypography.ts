import { FONT_PRESET_OPTIONS, fontStackForSelection, type FontPreset } from "@/lib/domain/theme";
import { field } from "./fields";

export const textTypographyFields = {
  fontFamily: field.select({
    label: "Font family",
    options: FONT_PRESET_OPTIONS,
    help: "Leave unset to keep the text style or heading font role. System fonts depend on the device.",
  }),
  fontSize: field.number({
    label: "Font size (px)",
    min: 8,
    max: 240,
    help: "Optional exact size on every screen. Clear to restore the responsive size preset.",
  }),
  textColor: field.color({
    label: "Text colour",
    help: "Optional colour in both themes. Clear to inherit the surrounding colour; check contrast in both themes.",
  }),
};

export interface TextTypography {
  fontFamily?: FontPreset;
  fontSize?: number;
  textColor?: string;
}

export function textTypographyStyle({ fontFamily, fontSize, textColor }: TextTypography) {
  const style: { fontFamily?: string; fontSize?: number; color?: string } = {};
  if (FONT_PRESET_OPTIONS.some((option) => option.value === fontFamily)) {
    style.fontFamily = fontStackForSelection(fontFamily!, []);
  }
  if (
    typeof fontSize === "number" &&
    Number.isFinite(fontSize) &&
    fontSize >= 8 &&
    fontSize <= 240
  ) {
    style.fontSize = fontSize;
  }
  if (textColor && /^#[0-9a-f]{6}$/i.test(textColor)) style.color = textColor;
  return Object.keys(style).length ? style : undefined;
}
