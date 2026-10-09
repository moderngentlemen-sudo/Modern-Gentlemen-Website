/**
 * Formatting inside a line of text, stored as light markup so a signature
 * stays one plain string:
 *
 *   **bold**   *italic*   __underline__   ~~strike~~   ==highlight==
 *   [words](link)   [words]{#C8102E}  (colour)
 *
 * The renderer turns it into inline <strong>/<em>/<u>/<s>/<span style> that
 * Gmail keeps. Pure: no DOM, no React.
 */

export type Mark = "bold" | "italic" | "underline" | "strike" | "highlight";

export const MARKS: Record<Mark, string> = {
  bold: "**",
  italic: "*",
  underline: "__",
  strike: "~~",
  highlight: "==",
};

export type RichNode =
  | { t: "text"; v: string }
  | { t: "mark"; mark: Mark; kids: RichNode[] }
  | { t: "link"; href: string; kids: RichNode[]; raw: string }
  | { t: "color"; color: string; kids: RichNode[] };

// Order matters: links and colours first, then ** before *.
const TOKEN =
  /\[([^\]\n]+)\]\(([^)\n]+)\)|\[([^\]\n]+)\]\{(#[0-9a-fA-F]{6})\}|\*\*(?=\S)([^\n]*?\S)\*\*(?!\*)|__(?=\S)([^\n]*?\S)__|~~(?=\S)([^\n]*?\S)~~|==(?=\S)([^\n]*?\S)==|\*(?=[^\s*])([^*\n]*?[^\s*])\*/;

export function parseRich(raw: string): RichNode[] {
  const out: RichNode[] = [];
  let rest = raw;
  while (rest) {
    const m = TOKEN.exec(rest);
    if (!m) {
      out.push({ t: "text", v: rest });
      break;
    }
    if (m.index) out.push({ t: "text", v: rest.slice(0, m.index) });
    if (m[1] !== undefined) out.push({ t: "link", href: m[2], kids: parseRich(m[1]), raw: m[0] });
    else if (m[3] !== undefined) out.push({ t: "color", color: m[4], kids: parseRich(m[3]) });
    else if (m[5] !== undefined) out.push({ t: "mark", mark: "bold", kids: parseRich(m[5]) });
    else if (m[6] !== undefined) out.push({ t: "mark", mark: "underline", kids: parseRich(m[6]) });
    else if (m[7] !== undefined) out.push({ t: "mark", mark: "strike", kids: parseRich(m[7]) });
    else if (m[8] !== undefined) out.push({ t: "mark", mark: "highlight", kids: parseRich(m[8]) });
    else out.push({ t: "mark", mark: "italic", kids: parseRich(m[9]) });
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

/** The text a reader sees (markup removed). */
export function plainRich(raw: string): string {
  const walk = (nodes: RichNode[]): string => nodes.map((n) => (n.t === "text" ? n.v : walk(n.kids))).join("");
  return walk(parseRich(raw));
}

/**
 * Toggle a mark around [start, end) of `text`. If the selection is already
 * wrapped in exactly that mark, the mark is removed. Returns the new text and
 * the new selection (so the same words stay selected).
 */
export function toggleMark(text: string, start: number, end: number, mark: Mark): { text: string; start: number; end: number } {
  const m = MARKS[mark];
  if (start === end) return { text, start, end };
  const before = text.slice(0, start);
  const sel = text.slice(start, end);
  const after = text.slice(end);
  // Selection includes the markers: "**word**" → "word".
  if (sel.length > m.length * 2 && sel.startsWith(m) && sel.endsWith(m) && !(mark === "italic" && sel.startsWith("**"))) {
    const inner = sel.slice(m.length, -m.length);
    return { text: before + inner + after, start, end: start + inner.length };
  }
  // Markers just outside the selection: "**|word|**" → "word".
  if (before.endsWith(m) && after.startsWith(m) && !(mark === "italic" && (before.endsWith("**") || after.startsWith("**")))) {
    const b = before.slice(0, -m.length);
    return { text: b + sel + after.slice(m.length), start: b.length, end: b.length + sel.length };
  }
  // Keep surrounding spaces outside the markers ("word " → "**word** ").
  const lead = sel.match(/^\s*/)![0];
  const trail = sel.match(/\s*$/)![0];
  const core = sel.slice(lead.length, sel.length - trail.length);
  if (!core) return { text, start, end };
  const wrapped = `${lead}${m}${core}${m}${trail}`;
  return { text: before + wrapped + after, start: start + lead.length, end: start + lead.length + core.length + m.length * 2 };
}

/** Colour the selected words: [words]{#hex}. Replaces an existing colour on exactly these words. */
export function colorWords(text: string, start: number, end: number, color: string): { text: string; start: number; end: number } {
  const sel = text.slice(start, end);
  const existing = /^\[([^\]\n]+)\]\{#[0-9a-fA-F]{6}\}$/.exec(sel);
  const words = (existing ? existing[1] : sel).replace(/[[\]]/g, "");
  if (!words.trim()) return { text, start, end };
  const out = `[${words}]{${color}}`;
  return { text: text.slice(0, start) + out + text.slice(end), start, end: start + out.length };
}

/**
 * Smart typography for the character just typed at `caret`: curly quotes and
 * apostrophes, "--" → em dash, "..." → ellipsis. Returns null when nothing
 * changes. Never touches link targets or colour codes, and never rewrites
 * anything but the characters at the caret (so phone numbers keep their hyphens).
 */
export function smartKey(prev: string, next: string, caret: number): { text: string; caret: number } | null {
  if (next.length !== prev.length + 1 || caret < 1) return null;
  const i = caret - 1;
  if (next.slice(0, i) + next.slice(i + 1) !== prev) return null;
  const before = next.slice(0, i);
  if (/\]\([^)]*$/.test(before) || /\]\{[^}]*$/.test(before)) return null;
  const ch = next[i];
  const p = next[i - 1] ?? "";
  const put = (from: number, to: number, rep: string) => ({ text: next.slice(0, from) + rep + next.slice(to), caret: from + rep.length });
  if (ch === '"') return put(i, i + 1, !p || /[\s([{“‘—–-]/.test(p) ? "“" : "”");
  if (ch === "'") return put(i, i + 1, !p || /[\s([{“—–-]/.test(p) ? "‘" : "’");
  if (ch === "." && next.slice(i - 2, i) === "..") return put(i - 2, i + 1, "…");
  if (ch === "-" && p === "-" && next[i - 2] !== "-") return put(i - 1, i + 1, "—");
  return null;
}
