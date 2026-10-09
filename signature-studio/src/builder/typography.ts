/**
 * One view of a block's typography for the formatting toolbar, whatever
 * mix of older per-block switches (text.bold, title.italic, name.upper…) and
 * newer style fields it uses. Writing through `setTypo` moves a block onto the
 * style fields and clears the old switch it replaces, so there is one source
 * of truth per setting.
 */
import type { Block, BlockStyle, ColorRole, Design, TextCase } from "../core/types";

export type RoleChoice = "auto" | ColorRole | "custom";

export interface Typo {
  font: string;
  /** 0 = the block's own default weight. */
  weight: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  textCase: TextCase;
  size: number;
  role: RoleChoice;
  color?: string;
  lineHeight: number;
  tracking: number;
}

type Legacy = { bold?: boolean; italic?: boolean; upper?: boolean; muted?: boolean; size?: number; scale?: number };

const nameSize = (d: Design, scale = 1) => Math.round(d.fontSize * d.nameScale * scale);

export function readTypo(b: Block, d: Design): Typo {
  const st: BlockStyle = b.style ?? {};
  const l = b as unknown as Legacy;
  const legacyUpper = (b.type === "text" || b.type === "name" || b.type === "title") && !!l.upper;
  const size = b.type === "text" ? (l.size ?? st.fontSize ?? d.fontSize) : b.type === "name" ? nameSize(d, l.scale) : (st.fontSize ?? d.fontSize);
  const weight = st.weight ?? (b.type === "text" && l.bold ? 700 : 0);
  return {
    font: st.font ?? "",
    weight,
    bold: weight >= 600,
    italic: st.italic ?? ((b.type === "text" || b.type === "title") && !!l.italic),
    underline: !!st.underline,
    strike: !!st.strike,
    textCase: st.case ?? (legacyUpper ? "upper" : "none"),
    size,
    role: st.color ? "custom" : (st.colorRole ?? (b.type === "text" && l.muted ? "muted" : "auto")),
    color: st.color,
    lineHeight: st.lineHeight ?? 1.4,
    tracking: st.tracking ?? 0,
  };
}

export type TypoChange =
  | { font: string }
  | { weight: number }
  | { bold: boolean }
  | { italic: boolean }
  | { underline: boolean }
  | { strike: boolean }
  | { textCase: TextCase }
  | { size: number }
  | { role: RoleChoice; color?: string }
  | { lineHeight: number }
  | { tracking: number };

/** A mutator for `updateBlock` that applies one toolbar change. */
export function setTypo(change: TypoChange, d: Design): (x: Block) => void {
  return (x) => {
    const st: BlockStyle = { ...x.style };
    const l = x as unknown as Legacy;
    if ("font" in change) st.font = change.font || undefined;
    if ("weight" in change) st.weight = change.weight || undefined;
    if ("bold" in change) st.weight = change.bold ? 700 : 400;
    if ("weight" in change || "bold" in change) if (x.type === "text") delete l.bold;
    if ("italic" in change) {
      st.italic = change.italic;
      if (x.type === "text" || x.type === "title") delete l.italic;
    }
    if ("underline" in change) st.underline = change.underline || undefined;
    if ("strike" in change) st.strike = change.strike || undefined;
    if ("textCase" in change) {
      // "none" is kept explicitly: it overrides a template's built-in capitals.
      st.case = change.textCase;
      if (x.type === "text" || x.type === "name" || x.type === "title") delete l.upper;
    }
    if ("size" in change) {
      const v = Math.max(8, Math.min(72, Math.round(change.size)));
      if (x.type === "text") l.size = v;
      else if (x.type === "name") l.scale = Math.round((v / (d.fontSize * d.nameScale)) * 100) / 100;
      else st.fontSize = v;
    }
    if ("role" in change) {
      if (x.type === "text") delete l.muted;
      st.colorRole = change.role === "auto" || change.role === "custom" ? undefined : change.role;
      st.color = change.role === "custom" ? (change.color ?? st.color ?? d.text) : undefined;
    }
    if ("lineHeight" in change) st.lineHeight = change.lineHeight === 1.4 ? undefined : change.lineHeight;
    if ("tracking" in change) st.tracking = change.tracking === 0 ? undefined : change.tracking;
    x.style = st;
  };
}

export const WEIGHTS = [
  { value: 0, label: "Default" },
  { value: 300, label: "Light" },
  { value: 400, label: "Regular" },
  { value: 500, label: "Medium" },
  { value: 600, label: "Semibold" },
  { value: 700, label: "Bold" },
  { value: 800, label: "Extra bold" },
];
