/**
 * Builder layouts: block factories, tree operations, and conversion of any
 * template (plus its enabled add-ons) into an editable block layout.
 * Pure functions — no React, no I/O.
 */
import { uid } from "../lib/id";
import type { Block, BlockType, Column, SignatureDoc } from "./types";
import { getTemplate, type LayoutId } from "./templates";

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

export function col(blocks: Block[] = [], o: Partial<Omit<Column, "id" | "blocks">> = {}): Column {
  return { id: uid("c"), gap: 6, ...o, blocks };
}

export function rowOf(columns: Column[], o: { gap?: number; valign?: "top" | "middle" | "bottom"; divider?: boolean } = {}): Block {
  return { id: uid("b"), type: "row", columns, gap: o.gap ?? 16, valign: o.valign ?? "top", divider: o.divider ?? false };
}

type Init<T extends BlockType> = Omit<Extract<Block, { type: T }>, "id" | "type">;

export function block<T extends BlockType>(type: T, init?: Partial<Init<T>>): Block {
  const defaults: { [K in BlockType]: Init<K> } = {
    row: { columns: [col(), col()], gap: 16, valign: "top", divider: false },
    name: {},
    title: {},
    field: { field: "company", upper: true },
    text: { text: "Your text here" },
    contacts: { layout: "stacked" },
    socials: {},
    photo: {},
    logo: {},
    image: { width: 300 },
    logos: { items: [], height: 36, gap: 14 },
    qr: { source: "website", url: "", size: 72, caption: "Scan to visit" },
    iconText: { icon: "clock", text: "Mon–Fri, 9am–5pm", url: "" },
    tag: { text: "Now hiring", url: "", filled: true },
    monogram: { size: 56 },
    divider: {},
    spacer: { height: 12 },
    button: { text: "Visit our website", url: "", buttonStyle: "solid", icon: "" },
    signOff: { text: "Best regards,", script: true },
    quote: { text: "Design is intelligence made visible.", author: "Alina Wheeler" },
    reviews: { rating: 5, text: "Read our reviews", url: "" },
    video: { url: "", title: "Watch our story" },
    apps: { appStore: "", googlePlay: "" },
    digitalCard: {},
    canva: {},
  };
  const base = structuredClone(defaults[type]) as Init<T>;
  // New rows get fresh column ids.
  if (type === "row") (base as unknown as Init<"row">).columns = [col(), col()];
  return { id: uid("b"), type, ...base, ...init } as Block;
}

// ---------------------------------------------------------------------------
// Tree operations (all mutate a draft — use inside an immer recipe)
// ---------------------------------------------------------------------------

export interface Location {
  column: Column;
  index: number;
}

export function* walk(root: Column): Generator<{ block: Block; parent: Column; index: number }> {
  for (let i = 0; i < root.blocks.length; i++) {
    const b = root.blocks[i];
    yield { block: b, parent: root, index: i };
    if (b.type === "row") for (const c of b.columns) yield* walk(c);
  }
}

export function findBlock(root: Column, id: string): { block: Block; parent: Column; index: number } | null {
  for (const hit of walk(root)) if (hit.block.id === id) return hit;
  return null;
}

export function findColumn(root: Column, id: string): Column | null {
  if (root.id === id) return root;
  for (const { block } of walk(root)) if (block.type === "row") for (const c of block.columns) if (c.id === id) return c;
  return null;
}

/** The row that owns a column (null for the root). */
export function rowOfColumn(root: Column, colId: string): Extract<Block, { type: "row" }> | null {
  for (const { block } of walk(root)) if (block.type === "row" && block.columns.some((c) => c.id === colId)) return block;
  return null;
}

/** Is `id` the block `ancestorId` or nested anywhere inside it? */
export function isWithin(root: Column, ancestorId: string, id: string): boolean {
  const hit = findBlock(root, ancestorId);
  if (!hit) return false;
  if (hit.block.id === id) return true;
  if (hit.block.type !== "row") return false;
  return hit.block.columns.some((c) => c.id === id || !!findBlock(c, id));
}

export function removeBlock(root: Column, id: string): Block | null {
  const hit = findBlock(root, id);
  if (!hit) return null;
  hit.parent.blocks.splice(hit.index, 1);
  return hit.block;
}

export function insertBlock(root: Column, b: Block, columnId: string, index: number): boolean {
  const target = findColumn(root, columnId);
  if (!target) return false;
  target.blocks.splice(Math.max(0, Math.min(index, target.blocks.length)), 0, b);
  return true;
}

/** Move a block to a column/index. Refuses to drop a row into itself. */
export function moveBlock(root: Column, id: string, columnId: string, index: number): boolean {
  if (isWithin(root, id, columnId)) return false;
  const hit = findBlock(root, id);
  if (!hit) return false;
  const target = findColumn(root, columnId);
  if (!target) return false;
  let at = index;
  if (target === hit.parent && hit.index < index) at -= 1;
  hit.parent.blocks.splice(hit.index, 1);
  target.blocks.splice(Math.max(0, Math.min(at, target.blocks.length)), 0, hit.block);
  return true;
}

/** Deep copy with fresh ids. */
export function cloneBlock(b: Block): Block {
  const copy = structuredClone(b);
  const renew = (x: Block) => {
    x.id = uid("b");
    if (x.type === "row")
      for (const c of x.columns) {
        c.id = uid("c");
        c.blocks.forEach(renew);
      }
  };
  renew(copy);
  return copy;
}

export function duplicateBlock(root: Column, id: string): Block | null {
  const hit = findBlock(root, id);
  if (!hit) return null;
  const copy = cloneBlock(hit.block);
  hit.parent.blocks.splice(hit.index + 1, 0, copy);
  return copy;
}

export function countBlocks(root: Column): number {
  let n = 0;
  for (const { block } of walk(root)) if (block.type !== "row") n++;
  return n;
}

// ---------------------------------------------------------------------------
// Template → builder layout
// ---------------------------------------------------------------------------

const B = block;

/** A single-column row with a panel around it: a styled group of blocks. */
export function panel(blocks: Block[], box: Column["box"], gap = 2): Block {
  return rowOf([col(blocks, { box, gap })]);
}

function mainText(extra: Block[] = []): Block[] {
  return [B("name"), B("title"), B("contacts"), B("socials"), ...extra];
}

/** A block layout that reproduces a template's layout. */
export function layoutBlocks(layout: LayoutId, doc: SignatureDoc): Block[] {
  const hasPhoto = !!doc.images.photo.assetId;
  const side = hasPhoto ? B("photo") : B("logo");
  const logoSmall = hasPhoto ? [B("logo", { size: 90 })] : [];
  switch (layout) {
    case "classic":
      return [rowOf([col([side]), col(mainText(logoSmall))], { divider: true })];
    case "photoRight":
      return [rowOf([col(mainText(logoSmall)), col([side])], { divider: true })];
    case "stacked":
      return [B("photo"), B("name"), B("title"), B("divider", { width: 260 }), B("contacts"), B("socials"), B("logo")];
    case "centered":
      return [
        side,
        B("name", { style: { align: "center" } }),
        B("title", { style: { align: "center" } }),
        B("divider", { width: 60 }),
        B("contacts", { layout: "inline", style: { align: "center" } }),
        B("socials", { style: { align: "center" } }),
        ...(hasPhoto ? [B("logo", { size: 90 })] : []),
      ];
    case "banner": {
      const d = doc.design;
      return [
        panel([B("name", { style: { color: "#ffffff" } }), B("title", { style: { color: "#f1efff" } })], { background: d.accent, padding: 16, radius: 8 }),
        rowOf([col([B("photo", { size: 64 })]), col([B("contacts"), B("socials")], { gap: 8 }), col([B("logo", { size: 90 })])], { gap: 14 }),
      ];
    }
    case "sidebar":
      return [
        rowOf(
          [
            col([B("photo")]),
            col(mainText([B("logo", { size: 90 })]), { box: { borderWidth: 4, borderColor: doc.design.accent, borderSide: "left", padding: 14 } }),
          ],
          {
            gap: 14,
          },
        ),
      ];
    case "card":
      return [
        panel(
          [rowOf([col([B("photo")]), col(mainText())], { valign: "middle" }), B("logo", { size: 80 })],
          { background: doc.design.surface, padding: 18, radius: 14 },
          12,
        ),
      ];
    case "split3":
      return [
        rowOf([col([B("photo")]), col([B("name"), B("title"), B("contacts")]), col([B("logo", { size: 90 }), B("socials")], { gap: 10 })], {
          divider: true,
          valign: "middle",
        }),
      ];
    case "compact":
      return [
        rowOf([col([B("photo", { size: 44 })]), col([B("name"), B("title"), B("contacts", { layout: "inline" }), B("socials", { size: 16 })], { gap: 4 })], {
          valign: "middle",
          gap: 12,
        }),
      ];
    case "editorial":
      return [
        B("field", { field: "company", upper: true }),
        B("name", { scale: 1.35 }),
        B("title", { italic: true, titleOnly: true }),
        B("divider", { width: 320 }),
        B("contacts", { layout: "inline" }),
        B("socials"),
        B("logo", { size: 90 }),
      ];
    case "monogram":
      return [rowOf([col([hasPhoto ? B("photo") : B("monogram", { size: 64 })]), col(mainText([B("logo", { size: 90 })]))])];
    case "grid":
      return [rowOf([col([B("name"), B("title"), B("divider"), B("contacts", { layout: "grid" }), B("socials")], { gap: 8 }), col([side])], { gap: 18 })];
    case "bold":
      return [
        rowOf(
          [
            col([side]),
            col([B("name", { scale: 1.25, underline: true }), B("title", { upper: true }), B("contacts", { iconBg: true }), B("socials")], { gap: 8 }),
          ],
          { gap: 18 },
        ),
      ];
    case "chips":
      return [
        B("photo"),
        rowOf([col([B("logo", { size: 56 })]), col([B("name"), B("title")], { gap: 2 })], { valign: "middle", gap: 12 }),
        B("contacts", { layout: "chips" }),
        B("socials"),
      ];
  }
}

/** Add-ons the user switched on in Quick mode, as blocks. */
export function addonBlocks(doc: SignatureDoc): { top: Block[]; bottom: Block[] } {
  const a = doc.addons;
  const top: Block[] = [];
  const bottom: Block[] = [];
  if (a.signOff.enabled) top.push(B("signOff", { text: a.signOff.text, script: a.signOff.script }));
  const buttons: Block[] = [];
  if (a.cta.enabled) buttons.push(B("button", { text: a.cta.text, url: a.cta.url, buttonStyle: a.cta.style }));
  if (a.meeting.enabled) buttons.push(B("button", { text: a.meeting.text, url: a.meeting.url, buttonStyle: "outline", icon: "calendar" }));
  if (buttons.length === 1) bottom.push(buttons[0]);
  if (buttons.length > 1)
    bottom.push(
      rowOf(
        buttons.map((b) => col([b])),
        { gap: 8 },
      ),
    );
  if (a.quote.enabled) bottom.push(B("quote", { text: a.quote.text, author: a.quote.author }));
  if (a.reviews.enabled) bottom.push(B("reviews", { rating: a.reviews.rating, text: a.reviews.text, url: a.reviews.url }));
  if (a.video.enabled) bottom.push(B("video", { assetId: a.video.assetId, url: a.video.url, title: a.video.title }));
  if (a.apps.enabled) bottom.push(B("apps", { appStore: a.apps.appStore, googlePlay: a.apps.googlePlay }));
  if (a.banner.enabled && a.banner.assetId)
    bottom.push(B("image", { assetId: a.banner.assetId, width: a.banner.width, link: a.banner.url, alt: a.banner.alt, radius: 8 }));
  if (doc.card.enabled && doc.card.assetId && !doc.card.cardOnly) bottom.push(B("canva"));
  if (doc.card.enabled && doc.card.assetId && doc.card.digitalLink) bottom.push(B("digitalCard"));
  if (a.disclaimer.enabled) bottom.push(B("text", { text: a.disclaimer.text, size: 10, muted: true }));
  if (a.green.enabled) bottom.push(B("text", { text: `🌿 ${a.green.text}`, size: 10, style: { color: "#3f8f4f" } }));
  return { top, bottom };
}

/** The full builder layout for a Quick-mode signature. */
export function blocksFromDoc(doc: SignatureDoc): Column {
  const t = getTemplate(doc.templateId);
  const { top, bottom } = addonBlocks(doc);
  const main = doc.card.enabled && doc.card.cardOnly && doc.card.assetId ? [B("canva")] : layoutBlocks(t.layout, doc);
  return col([...top, ...main, ...bottom], { gap: 12, align: doc.design.align === "center" ? "center" : "left" });
}
