/**
 * Spacing and separators for the contacts block, shared by the renderer, the
 * inspector and the canvas handles so all three agree on the defaults.
 */
import type { Block, ContactIcons, ContactSeparator, Design } from "./types";

type Contacts = Extract<Block, { type: "contacts" }>;

/** Built-in gaps, in spacing units (multiplied by design.spacing). */
const ROW: Record<Contacts["layout"], number> = { stacked: 3, inline: 0, grid: 4, chips: 6 };
const COL: Record<Contacts["layout"], number> = { stacked: 0, inline: 0, grid: 18, chips: 6 };

/** Which gaps a layout has: a list only stacks, one line only runs sideways. */
export const hasRowGap = (l: Contacts["layout"]) => l !== "inline";
export const hasColGap = (l: Contacts["layout"]) => l !== "stacked";

/** The space between rows, px before the whole-signature scale. */
export function rowGapOf(b: Contacts, d: Pick<Design, "spacing">): number {
  return b.rowGap ?? Math.round(ROW[b.layout] * d.spacing);
}

/** The space between fields side by side. One line's default is the two spaces either side of its bar. */
export function colGapOf(b: Contacts, d: Pick<Design, "spacing" | "fontSize">): number {
  if (b.colGap !== undefined) return b.colGap;
  return b.layout === "inline" ? Math.round(d.fontSize * 1.1) : Math.round(COL[b.layout] * d.spacing);
}

/** The block's icon style: its own switch wins over the Design setting. */
export function iconModeOf(b: Contacts, d: Pick<Design, "contactIcons">): ContactIcons {
  if (b.icons === false) return "none";
  if (b.icons === true && d.contactIcons === "none") return "icons";
  return d.contactIcons;
}

/** The symbol between fields side by side. One line has always shown a bar; the other layouts show none until one is picked. */
export function separatorOf(b: Contacts): ContactSeparator {
  return b.separator ?? (b.layout === "inline" ? "bar" : "none");
}

/** Which divider controls a layout offers: a symbol between fields side by side, a line between rows. */
export const hasSeparator = (l: Contacts["layout"]) => l !== "stacked";
export const hasRowRule = (l: Contacts["layout"]) => l === "stacked" || l === "grid";

/** Largest gaps the inspector and the canvas allow. */
export const MAX_COL_GAP = 200;
export const MAX_ROW_GAP = 80;

export const SEPARATOR_GLYPH: Record<ContactSeparator, string> = { bar: "|", dot: "·", slash: "/", dash: "–", none: "" };
