import { libraryFontStack } from "@/lib/domain/fontLibrary";
import { field } from "./fields";

export const textTypographyFields = {
  fontFamily: field.font({
    label: "Font family",
    help: "Leave unset to keep the text style or heading font role. System fonts depend on the device.",
  }),
  fontSize: field.number({
    label: "Font size (px)",
    min: 8,
    max: 240,
    help: "Optional exact size on every screen. Clear to restore the responsive size preset.",
  }),
  fontWeight: field.select({
    label: "Font weight",
    options: [100, 200, 300, 400, 500, 600, 700, 800, 900].map((weight) => ({
      value: String(weight),
      label: String(weight),
    })),
    help: "Leave unset to use the existing style. The browser uses the closest available weight listed in the font preview.",
  }),
  fontStyle: field.select({
    label: "Font style",
    options: [
      { value: "normal", label: "Normal" },
      { value: "italic", label: "Italic" },
    ],
    help: "Leave unset to preserve the existing style. Italics may be simulated if the family has no italic face.",
  }),
  textColor: field.color({
    label: "Text colour",
    help: "Optional colour in both themes. Clear to inherit the surrounding colour; check contrast in both themes.",
  }),
  textAlign: field.select({
    label: "Text alignment",
    options: ["left", "center", "right", "justify"].map((value) => ({ value, label: value })),
  }),
  lineHeight: field.number({ label: "Line spacing", min: 0.7, max: 3 }),
  letterSpacing: field.number({ label: "Letter spacing (em)", min: -0.1, max: 0.5 }),
  textTransform: field.select({
    label: "Letter case",
    options: ["none", "uppercase", "lowercase", "capitalize"].map((value) => ({
      value,
      label: value,
    })),
  }),
  textDecoration: field.select({
    label: "Decoration",
    options: ["none", "underline", "line-through", "underline line-through"].map((value) => ({
      value,
      label: value,
    })),
  }),
};

export interface TextTypography {
  fontFamily?: string;
  fontSize?: number;
  textColor?: string;
  fontWeight?: string;
  fontStyle?: "normal" | "italic";
  textAlign?: "left" | "center" | "right" | "justify";
  lineHeight?: number;
  letterSpacing?: number;
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
  textDecoration?: string;
}

export function textTypographyStyle({
  fontFamily,
  fontSize,
  textColor,
  fontWeight,
  fontStyle,
  textAlign,
  lineHeight,
  letterSpacing,
  textTransform,
  textDecoration,
}: TextTypography) {
  const style: {
    fontFamily?: string;
    fontSize?: number;
    color?: string;
    fontWeight?: number;
    fontStyle?: "normal" | "italic";
    textAlign?: TextTypography["textAlign"];
    lineHeight?: number;
    letterSpacing?: string;
    textTransform?: TextTypography["textTransform"];
    textDecoration?: string;
  } = {};
  if (fontWeight && /^[1-9]00$/.test(fontWeight)) style.fontWeight = Number(fontWeight);
  if (fontStyle === "normal" || fontStyle === "italic") style.fontStyle = fontStyle;
  const stack = libraryFontStack(fontFamily);
  if (stack) style.fontFamily = stack;
  if (
    typeof fontSize === "number" &&
    Number.isFinite(fontSize) &&
    fontSize >= 8 &&
    fontSize <= 240
  ) {
    style.fontSize = fontSize;
  }
  if (textColor && /^#[0-9a-f]{6}$/i.test(textColor)) style.color = textColor;
  if (textAlign && ["left", "center", "right", "justify"].includes(textAlign))
    style.textAlign = textAlign;
  if (
    typeof lineHeight === "number" &&
    Number.isFinite(lineHeight) &&
    lineHeight >= 0.7 &&
    lineHeight <= 3
  )
    style.lineHeight = lineHeight;
  if (
    typeof letterSpacing === "number" &&
    Number.isFinite(letterSpacing) &&
    letterSpacing >= -0.1 &&
    letterSpacing <= 0.5
  )
    style.letterSpacing = `${letterSpacing}em`;
  if (textTransform && ["none", "uppercase", "lowercase", "capitalize"].includes(textTransform))
    style.textTransform = textTransform;
  if (
    textDecoration &&
    ["none", "underline", "line-through", "underline line-through"].includes(textDecoration)
  )
    style.textDecoration = textDecoration;
  return Object.keys(style).length ? style : undefined;
}
