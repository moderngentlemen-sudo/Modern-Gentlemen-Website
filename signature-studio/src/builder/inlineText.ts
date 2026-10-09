/** Which text a block lets you edit right on the canvas, and where it's stored. */
import type { Block, DetailKey, SignatureDoc } from "../core/types";

export interface InlineTarget {
  value: string;
  multiline: boolean;
  /** Supports `[words](link)` via ⌘K. */
  linkable?: boolean;
  /** Write the new text (inside an edit recipe). */
  apply: (doc: SignatureDoc, block: Block, value: string) => void;
}

const detail = (doc: SignatureDoc, key: DetailKey): InlineTarget => ({
  value: doc.details[key],
  multiline: false,
  apply: (d, _b, v) => void (d.details[key] = v),
});

/** Blocks whose own `text` is what you see. */
const OWN_TEXT = new Set(["text", "quote", "button", "tag", "iconText", "signOff"]);

export function inlineTarget(b: Block, doc: SignatureDoc): InlineTarget | null {
  if (b.type === "name") return detail(doc, "name");
  if (b.type === "title") return detail(doc, "title");
  if (b.type === "field") return detail(doc, b.field);
  if (OWN_TEXT.has(b.type) && "text" in b) {
    return {
      value: b.text,
      multiline: b.type === "text" || b.type === "quote",
      linkable: b.type === "text",
      apply: (_d, x, v) => {
        if ("text" in x) (x as { text: string }).text = v;
      },
    };
  }
  return null;
}
