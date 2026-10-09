import { useState, type ReactNode } from "react";
import { ChevronRight, Copy, Minus, Plus, Sparkles, Trash2, X } from "lucide-react";
import { SIGN_OFFS } from "../core/seasonal";
import { ICON_CHOICES } from "../core/iconPaths";
import { glyphSvg, svgDataUrl } from "../render/icons";
import { uid } from "../lib/id";
import { col, findBlock, findColumn, pathTo } from "../core/blocks";
import { FONTS, fontDef } from "../core/fonts";
import type { Align, Block, BlockStyle, Box, ButtonStyle, Column, Design, DetailKey } from "../core/types";
import { edit, toast, ui, useStudio, type Tab, tree, treeOf } from "../store/editor";
import { ImageDrop } from "../ui/ImageDrop";
import { ImageStudio } from "./ImageStudio";
import { LinkableText } from "../ui/LinkableText";
import { ColorField, Field, Segmented, SectionTitle, Select, Slider, TextField, Toggle } from "../ui/kit";
import { DirectionControl, MadeWithToggle, ReplyControl, ScaleControl } from "../panels/DesignPanel";
import { duplicateSelected, removeSelected, resizeSelection, updateBlock, updateColumn, updateSelected, wrapSelected } from "./actions";
import { blockLabel } from "./catalog";
import { TextFormatBar } from "./TextFormatBar";
import { readTypo, WEIGHTS } from "./typography";

const ALIGN = [
  { value: "left" as const, label: "Left" },
  { value: "center" as const, label: "Centre" },
  { value: "right" as const, label: "Right" },
];

function GoTo({ tab, children }: { tab: Tab; children: ReactNode }) {
  return (
    <button className="btn sm" onClick={() => ui({ tab })}>
      {children}
    </button>
  );
}

function BoxEditor({ value, onChange, label = "Background panel" }: { value?: Box; onChange: (b: Box | undefined, key?: string) => void; label?: string }) {
  const on = !!value && !!(value.background || value.padding || value.borderWidth);
  return (
    <>
      <Toggle label={label} checked={on} onChange={(v) => onChange(v ? { background: "#f3f1fb", padding: 14, radius: 10 } : undefined)} />
      {on && value && (
        <>
          <ColorField
            label="Fill"
            value={value.background ?? "#ffffff"}
            onChange={(c) => onChange({ ...value, background: c }, "bg")}
            swatches={["#ffffff", "#f3f1fb", "#f6f4ef", "#eef5fc", "#15131a", "#ff5434"]}
          />
          <Slider label="Padding" unit="px" min={0} max={40} value={value.padding ?? 0} onChange={(v) => onChange({ ...value, padding: v }, "pad")} />
          <Slider label="Corner radius" unit="px" min={0} max={32} value={value.radius ?? 0} onChange={(v) => onChange({ ...value, radius: v }, "radius")} />
          <Slider label="Border" unit="px" min={0} max={6} value={value.borderWidth ?? 0} onChange={(v) => onChange({ ...value, borderWidth: v }, "bw")} />
          {!!value.borderWidth && (
            <>
              <ColorField label="Border colour" value={value.borderColor ?? "#dddddd"} onChange={(c) => onChange({ ...value, borderColor: c }, "bc")} />
              <Field label="Border on">
                <Segmented
                  label="Border side"
                  value={value.borderSide ?? "all"}
                  onChange={(s) => onChange({ ...value, borderSide: s })}
                  options={[
                    { value: "all", label: "All" },
                    { value: "left", label: "Left" },
                    { value: "top", label: "Top" },
                    { value: "bottom", label: "Bottom" },
                  ]}
                />
              </Field>
            </>
          )}
        </>
      )}
    </>
  );
}

/** Blocks whose HTML contains a link or an image, so a tooltip has somewhere to live. */
const HOVERABLE = new Set<Block["type"]>([
  "name",
  "title",
  "field",
  "text",
  "contacts",
  "socials",
  "button",
  "image",
  "photo",
  "logo",
  "logos",
  "qr",
  "iconText",
  "tag",
  "reviews",
  "video",
  "apps",
  "digitalCard",
  "canva",
]);

/** A contact detail edited right in the inspector (the same value the Details tab edits). */
function DetailField({ k, label, hint }: { k: DetailKey; label: string; hint?: string }) {
  const value = useStudio((s) => s.doc!.details[k]);
  return <TextField label={label} hint={hint} value={value} onChange={(v) => edit((d) => void (d.details[k] = v), `details.${k}`)} testId={`detail-${k}`} />;
}

function LinkField({ value, onChange, hint = "optional" }: { value?: string; onChange: (v: string | undefined) => void; hint?: string }) {
  return (
    <TextField
      label="Link"
      hint={hint}
      placeholder="Website, email or phone"
      value={value ?? ""}
      onChange={(v) => onChange(v.trim() ? v : undefined)}
      testId="inspector-link"
    />
  );
}

function ColumnEditor({ column, index }: { column: Column; index: number }) {
  return (
    <div className="card" style={{ padding: 12, marginBottom: 10 }}>
      <strong style={{ fontSize: 13 }}>Column {index + 1}</strong>
      <div style={{ height: 8 }} />
      <Field label="Align contents">
        <Segmented<Align> label="Column alignment" value={column.align ?? "left"} onChange={(v) => updateColumn(column.id, { align: v })} options={ALIGN} />
      </Field>
      <Slider
        label="Width"
        hint={column.width ? undefined : "auto"}
        unit="px"
        min={0}
        max={500}
        step={10}
        value={column.width ?? 0}
        onChange={(v) => updateColumn(column.id, { width: v || undefined }, "w")}
      />
      <Slider label="Space between blocks" unit="px" min={0} max={30} value={column.gap} onChange={(v) => updateColumn(column.id, { gap: v }, "gap")} />
      <BoxEditor value={column.box} onChange={(b, k) => updateColumn(column.id, { box: b }, k)} />
    </div>
  );
}

function StyleEditor({ b }: { b: Block }) {
  const st = b.style ?? {};
  const setStyle = (patch: Partial<BlockStyle>, key?: string) => updateBlock(b.id, (x) => void (x.style = { ...x.style, ...patch }), key);
  const textual = !["row", "spacer", "divider", "image", "photo", "logo", "canva", "video"].includes(b.type);
  const design = useStudio((s) => s.doc!.design);
  return (
    <>
      <SectionTitle>Style</SectionTitle>
      {b.type !== "row" && b.type !== "spacer" && (
        <Field label="Alignment">
          <Segmented<Align> label="Alignment" value={st.align ?? "left"} onChange={(v) => setStyle({ align: v })} options={ALIGN} />
        </Field>
      )}
      {textual && <TextFormatBar b={b} />}
      {["contacts", "socials", "button", "monogram", "divider", "reviews", "quote", "name"].includes(b.type) && (
        <ColorField label="Accent colour" value={st.accent ?? design.accent} onChange={(c) => setStyle({ accent: c }, "accent")} extra={[design.accent]} />
      )}
      {(st.color ||
        st.colorRole ||
        st.font ||
        st.fontSize ||
        st.accent ||
        st.weight ||
        st.italic !== undefined ||
        st.underline ||
        st.strike ||
        st.case ||
        st.lineHeight ||
        st.tracking !== undefined) && (
        <button className="btn sm ghost" onClick={() => updateBlock(b.id, (x) => void (x.style = { align: x.style?.align, box: x.style?.box }))}>
          Reset to signature style
        </button>
      )}
    </>
  );
}

/** One-line description of a block's style, shown when its section is folded. */
function styleSummary(b: Block, d: Design): string {
  const st = b.style ?? {};
  const textual = !["row", "spacer", "divider", "image", "photo", "logo", "canva", "video"].includes(b.type);
  const parts: string[] = [];
  if (textual) {
    const t = readTypo(b, d);
    parts.push(t.font ? fontDef(t.font).label : "Signature font", `${t.size}px`);
    if (t.weight) parts.push(WEIGHTS.find((w) => w.value === t.weight)?.label ?? String(t.weight));
    if (t.role !== "auto")
      parts.push(t.role === "custom" ? (t.color ?? "").toUpperCase() : t.role === "muted" ? "Muted" : t.role === "accent" ? "Accent" : "Text colour");
  }
  if (st.align && st.align !== "left") parts.push(st.align === "center" ? "Centred" : "Right");
  return parts.join(" · ") || "Signature style";
}

const SECTION_KEY = "signet.inspector.sections";
const readOpen = (): Record<string, boolean> => {
  try {
    return JSON.parse(localStorage.getItem(SECTION_KEY) ?? "{}") as Record<string, boolean>;
  } catch {
    return {};
  }
};

/** A foldable inspector section; folded, it shows a summary instead of its controls. Remembered per section. */
function Section({
  id,
  title,
  summary,
  defaultOpen = true,
  children,
}: {
  id: string;
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(() => readOpen()[id] ?? defaultOpen);
  const toggle = () => {
    setOpen(!open);
    try {
      localStorage.setItem(SECTION_KEY, JSON.stringify({ ...readOpen(), [id]: !open }));
    } catch {
      /* a convenience only */
    }
  };
  return (
    <section className={`insp-section${open ? " open" : ""}`}>
      <button type="button" className="insp-section-head" aria-expanded={open} onClick={toggle} data-testid={`section-${id}`}>
        <ChevronRight size={14} className="chev" />
        <span className="insp-section-title">{title}</span>
        {!open && summary && <span className="insp-section-sum">{summary}</span>}
      </button>
      {open && <div className="insp-section-body">{children}</div>}
    </section>
  );
}

/** Where the selected block sits: Signature › Columns › Column 2 › Text. Each step selects that level. */
function Breadcrumb({ id, label }: { id: string; label: string }) {
  const root = useStudio(treeOf);
  if (!root) return null;
  const path = pathTo(root, id);
  if (!path.length) return null;
  return (
    <nav className="crumbs" aria-label="Where this block is" data-testid="breadcrumb">
      <button type="button" onClick={() => ui({ selected: null })}>
        Signature
      </button>
      {path.map((p) => (
        <span key={p.kind === "row" ? p.block.id : p.column.id}>
          <ChevronRight size={11} aria-hidden="true" />
          <button type="button" onClick={() => ui({ selected: p.kind === "row" ? p.block.id : p.column.id, multi: [] })}>
            {p.kind === "row" ? "Columns" : `Column ${p.index}`}
          </button>
        </span>
      ))}
      <span>
        <ChevronRight size={11} aria-hidden="true" />
        <b>{label}</b>
      </span>
    </nav>
  );
}

/** 0-based position of a column in its row. */
function columnIndex(root: Column, id: string): number {
  const path = pathTo(root, id);
  const row = path.at(-1);
  return row?.kind === "row" && row.block.type === "row" ? row.block.columns.findIndex((c) => c.id === id) : 0;
}

const SHOW_IN: Record<string, string> = { both: "New emails & replies", full: "New emails only", reply: "Replies only", hidden: "Hidden" };

function Content({ b }: { b: Block }) {
  const set = (patch: Record<string, unknown>, key?: string) => updateBlock(b.id, patch as Partial<Block>, key);
  const details = useStudio((s) => s.doc!.details);
  switch (b.type) {
    case "row":
      return (
        <>
          <Field label={`Columns (${b.columns.length})`}>
            <div className="row">
              <button
                className="btn sm"
                disabled={b.columns.length <= 1}
                onClick={() => updateBlock(b.id, (x) => x.type === "row" && x.columns.length > 1 && void x.columns.pop())}
                aria-label="Remove a column"
              >
                <Minus size={14} />
              </button>
              <button
                className="btn sm"
                disabled={b.columns.length >= 4}
                onClick={() => updateBlock(b.id, (x) => x.type === "row" && void x.columns.push(col()))}
                aria-label="Add a column"
              >
                <Plus size={14} /> Column
              </button>
            </div>
          </Field>
          <Slider label="Space between columns" unit="px" min={0} max={40} value={b.gap} onChange={(v) => set({ gap: v }, "gap")} />
          <Field label="Line up columns">
            <Segmented
              label="Vertical alignment"
              value={b.valign}
              onChange={(v) => set({ valign: v })}
              options={[
                { value: "top", label: "Top" },
                { value: "middle", label: "Middle" },
                { value: "bottom", label: "Bottom" },
              ]}
            />
          </Field>
          <Toggle label="Divider between columns" checked={b.divider} onChange={(v) => set({ divider: v })} />
          {b.columns.map((c, i) => (
            <ColumnEditor key={c.id} column={c} index={i} />
          ))}
        </>
      );
    case "name":
      return (
        <>
          <DetailField k="name" label="Name" />
          <Slider label="Size" unit="×" min={0.7} max={2.2} step={0.05} value={b.scale ?? 1} onChange={(v) => set({ scale: v }, "scale")} />
          <Toggle label="Accent underline" checked={!!b.underline} onChange={(v) => set({ underline: v })} />
          <LinkField value={b.link} onChange={(v) => set({ link: v }, "link")} />
        </>
      );
    case "title":
      return (
        <>
          <DetailField k="title" label="Job title" />
          {!b.titleOnly && (
            <>
              <DetailField k="department" label="Department" hint="optional" />
              <DetailField k="company" label="Company" />
            </>
          )}
          <Toggle label="Job title only" checked={!!b.titleOnly} onChange={(v) => set({ titleOnly: v })} />
          <LinkField value={b.link} onChange={(v) => set({ link: v }, "link")} />
        </>
      );
    case "field":
      return (
        <>
          <Select<DetailKey>
            label="Show"
            value={b.field}
            onChange={(v) => set({ field: v })}
            options={(["company", "department", "title", "pronouns", "phone", "mobile", "email", "website", "address"] as DetailKey[]).map((k) => ({
              value: k,
              label: k[0].toUpperCase() + k.slice(1),
            }))}
          />
          <TextField label="Value" value={details[b.field]} onChange={(v) => edit((d) => void (d.details[b.field] = v), `details.${b.field}`)} />
          <Toggle label="Label style" hint="Small, spaced capitals in the accent colour" checked={!!b.upper} onChange={(v) => set({ upper: v })} />
          <LinkField value={b.link} onChange={(v) => set({ link: v }, "link")} hint="instead of the usual one" />
        </>
      );
    case "text":
      return (
        <>
          <LinkableText label="Text" value={b.text} onChange={(v) => set({ text: v }, "text")} testId="inspector-text" />

          <LinkField value={b.link} onChange={(v) => set({ link: v }, "link")} hint="makes the whole block a link" />
        </>
      );
    case "contacts":
      return (
        <>
          <Field label="Layout">
            <Segmented
              label="Contacts layout"
              value={b.layout}
              onChange={(v) => set({ layout: v })}
              options={[
                { value: "stacked", label: "List" },
                { value: "inline", label: "One line" },
                { value: "grid", label: "Grid" },
                { value: "chips", label: "Chips" },
              ]}
            />
          </Field>
          <Toggle label="Filled icon badges" checked={!!b.iconBg} onChange={(v) => set({ iconBg: v })} />
          <DetailField k="phone" label="Phone" />
          <DetailField k="mobile" label="Mobile" hint="optional" />
          <DetailField k="email" label="Email" />
          <DetailField k="website" label="Website" />
          <DetailField k="address" label="Address" hint="optional" />
          <p className="hint">
            Shared with your saved profile. Icon style is set in Design. <GoTo tab="details">All details</GoTo>
          </p>
        </>
      );
    case "socials":
      return (
        <>
          <Slider label="Icon size" unit="px" min={14} max={40} value={b.size ?? 22} onChange={(v) => set({ size: v }, "size")} />
          <GoTo tab="social">Edit social links</GoTo>
        </>
      );
    case "photo":
    case "logo":
      return (
        <>
          <Slider label="Size" unit="px" min={32} max={240} value={b.size ?? (b.type === "photo" ? 84 : 110)} onChange={(v) => set({ size: v }, "size")} />
          <ImageStudio arg={b.type} editTestId={`adjust-${b.type}`} />
          <p className="hint">The {b.type === "photo" ? "photo" : "logo"} is shared by every layout of this signature.</p>
        </>
      );
    case "image":
      return (
        <>
          <ImageStudio arg={`block:${b.id}`} editTestId="adjust-image" />
          <button className="btn sm" onClick={() => ui({ dialog: "banners", dialogArg: `block:${b.id}` })} data-testid="open-banners">
            <Sparkles size={14} /> Seasonal &amp; promo banners
          </button>
          <Slider label="Width" unit="px" min={40} max={640} step={10} value={b.width} onChange={(v) => set({ width: v }, "width")} />
          <TextField label="Link" placeholder="https://…" value={b.link ?? ""} onChange={(v) => set({ link: v }, "link")} />
          <TextField label="Description" hint="for screen readers" value={b.alt ?? ""} onChange={(v) => set({ alt: v }, "alt")} />
        </>
      );
    case "logos":
      return (
        <>
          {b.items.map((it, i) => (
            <div key={it.id} className="list-item" style={{ display: "grid", gap: 8 }}>
              <div className="row">
                <ImageDrop
                  assetId={it.assetId}
                  label={`logo ${i + 1}`}
                  style={{ width: 84, height: 48 }}
                  onFile={(m) =>
                    edit((d) => {
                      d.assets[m.id] = m;
                      const h = tree(d) && findBlock(tree(d), b.id);
                      if (h && h.block.type === "logos") h.block.items[i].assetId = m.id;
                    })
                  }
                />
                <div style={{ display: "grid", gap: 6, flex: 1, minWidth: 0 }}>
                  <input
                    className="input sm"
                    placeholder="Link (optional)"
                    value={it.link ?? ""}
                    aria-label="Logo link"
                    onChange={(e) => updateBlock(b.id, (x) => x.type === "logos" && void (x.items[i].link = e.target.value), `item.${it.id}.link`)}
                  />
                  <input
                    className="input sm"
                    placeholder="Name, e.g. Best of 2026"
                    value={it.alt ?? ""}
                    aria-label="Logo description"
                    onChange={(e) => updateBlock(b.id, (x) => x.type === "logos" && void (x.items[i].alt = e.target.value), `item.${it.id}.alt`)}
                  />
                </div>
                <button
                  className="icon-btn sm"
                  aria-label="Remove logo"
                  onClick={() => updateBlock(b.id, (x) => x.type === "logos" && void x.items.splice(i, 1))}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
          <button className="btn sm" onClick={() => updateBlock(b.id, (x) => x.type === "logos" && void x.items.push({ id: uid("i") }))} data-testid="add-logo">
            <Plus size={14} /> Add a logo
          </button>
          <div style={{ height: 10 }} />
          <Slider label="Height" unit="px" min={16} max={120} value={b.height} onChange={(v) => set({ height: v }, "height")} />
          <Slider label="Space between" unit="px" min={0} max={40} value={b.gap} onChange={(v) => set({ gap: v }, "gap")} />
          <p className="hint">Certifications, awards, partners or press logos.</p>
        </>
      );
    case "qr":
      return (
        <>
          <Field label="Opens">
            <Segmented
              label="QR code target"
              value={b.source}
              onChange={(v) => set({ source: v })}
              options={[
                { value: "website", label: "My website" },
                { value: "digitalCard", label: "Digital card" },
                { value: "custom", label: "Other link" },
              ]}
            />
          </Field>
          {b.source === "custom" && <TextField label="Link" placeholder="https://…" value={b.url} onChange={(v) => set({ url: v }, "url")} />}
          <Slider label="Size" unit="px" min={48} max={200} value={b.size} onChange={(v) => set({ size: v }, "size")} />
          <TextField label="Caption" hint="optional" value={b.caption} onChange={(v) => set({ caption: v }, "caption")} />
        </>
      );
    case "iconText":
      return (
        <>
          <TextField label="Text" value={b.text} onChange={(v) => set({ text: v }, "text")} testId="inspector-text" />
          <TextField label="Link" hint="optional" placeholder="https://…" value={b.url} onChange={(v) => set({ url: v }, "url")} />
          <Field label="Icon">
            <div className="icon-grid">
              {ICON_CHOICES.map((ic) => (
                <button key={ic.id} type="button" aria-pressed={b.icon === ic.id} title={ic.label} aria-label={ic.label} onClick={() => set({ icon: ic.id })}>
                  <img src={svgDataUrl(glyphSvg(ic.id, 36, "#15131a"))} width={18} height={18} alt="" />
                </button>
              ))}
            </div>
          </Field>
          <Toggle label="Filled icon badge" checked={!!b.iconBg} onChange={(v) => set({ iconBg: v })} />
        </>
      );
    case "tag":
      return (
        <>
          <TextField label="Text" value={b.text} onChange={(v) => set({ text: v }, "text")} testId="inspector-text" />
          <TextField label="Link" hint="optional" placeholder="https://…" value={b.url} onChange={(v) => set({ url: v }, "url")} />
          <Toggle label="Filled" checked={b.filled} onChange={(v) => set({ filled: v })} />
        </>
      );
    case "monogram":
      return <Slider label="Size" unit="px" min={32} max={120} value={b.size} onChange={(v) => set({ size: v }, "size")} />;
    case "divider":
      return (
        <>
          <Slider
            label="Length"
            hint={b.width ? undefined : "full width"}
            unit="px"
            min={0}
            max={600}
            step={10}
            value={b.width ?? 0}
            onChange={(v) => set({ width: v || undefined }, "width")}
          />
          <Slider label="Thickness" unit="px" min={1} max={6} value={b.thickness ?? 1} onChange={(v) => set({ thickness: v }, "thick")} />
        </>
      );
    case "spacer":
      return <Slider label="Height" unit="px" min={4} max={60} value={b.height} onChange={(v) => set({ height: v }, "h")} />;
    case "button":
      return (
        <>
          <TextField label="Button text" value={b.text} onChange={(v) => set({ text: v }, "text")} />
          <TextField label="Link" placeholder="Your website if left blank" value={b.url} onChange={(v) => set({ url: v }, "url")} />
          <Field label="Style">
            <Segmented<ButtonStyle>
              label="Button style"
              value={b.buttonStyle}
              onChange={(v) => set({ buttonStyle: v })}
              options={[
                { value: "solid", label: "Solid" },
                { value: "pill", label: "Pill" },
                { value: "outline", label: "Outline" },
                { value: "link", label: "Link" },
              ]}
            />
          </Field>
          <Toggle label="Calendar icon" checked={b.icon === "calendar"} onChange={(v) => set({ icon: v ? "calendar" : "" })} />
        </>
      );
    case "signOff":
      return (
        <>
          <TextField label="Text" value={b.text} onChange={(v) => set({ text: v }, "text")} />
          <Select
            label="Ready-made"
            value=""
            onChange={(v) => v && set({ text: v })}
            options={[{ value: "", label: "Choose a sign-off…" }, ...SIGN_OFFS.flatMap((g) => g.items.map((t) => ({ value: t, label: `${g.label} · ${t}` })))]}
          />
          <Toggle label="Handwritten script" hint="Sent as an image so it looks the same everywhere" checked={b.script} onChange={(v) => set({ script: v })} />
        </>
      );
    case "quote":
      return (
        <>
          <TextField label="Quote" multiline value={b.text} onChange={(v) => set({ text: v }, "text")} />
          <TextField label="Author" value={b.author} onChange={(v) => set({ author: v }, "author")} />
        </>
      );
    case "reviews":
      return (
        <>
          <Slider label="Stars" min={1} max={5} value={b.rating} onChange={(v) => set({ rating: v }, "rating")} />
          <TextField label="Text" value={b.text} onChange={(v) => set({ text: v }, "text")} />
          <TextField label="Reviews link" placeholder="g.page/your-business/review" value={b.url} onChange={(v) => set({ url: v }, "url")} />
        </>
      );
    case "video":
      return (
        <>
          <Field label="Thumbnail">
            <ImageDrop
              assetId={b.assetId}
              label="video thumbnail"
              style={{ width: 160, height: 90 }}
              onFile={(m) =>
                edit((d) => {
                  d.assets[m.id] = m;
                  const hit = tree(d) && findBlock(tree(d), b.id);
                  if (hit && hit.block.type === "video") hit.block.assetId = m.id;
                })
              }
            />
          </Field>
          <TextField label="Video link" placeholder="youtube.com/watch?v=…" value={b.url} onChange={(v) => set({ url: v }, "url")} />
          <TextField label="Title" value={b.title} onChange={(v) => set({ title: v }, "title")} />
        </>
      );
    case "apps":
      return (
        <>
          <TextField label="App Store link" placeholder="apps.apple.com/app/…" value={b.appStore} onChange={(v) => set({ appStore: v }, "as")} />
          <TextField label="Google Play link" placeholder="play.google.com/store/apps/…" value={b.googlePlay} onChange={(v) => set({ googlePlay: v }, "gp")} />
        </>
      );
    case "canva":
      return (
        <>
          <p className="hint">Shows your Canva design with its clickable areas.</p>
          <GoTo tab="card">Open Canva settings</GoTo>
        </>
      );
    case "digitalCard":
      return (
        <>
          <p className="hint">A QR code and link to your digital business card. It needs a card design in the Canva tab.</p>
          <GoTo tab="card">Open Canva settings</GoTo>
        </>
      );
  }
}

function SignatureSettings() {
  const root = useStudio(treeOf)!;
  const width = useStudio((s) => s.doc!.design.width);
  if (!root) return null;
  return (
    <>
      <h3 className="insp-title">Signature</h3>
      <p className="hint" style={{ marginTop: -4 }}>
        Select any part of your signature to edit it. Drag blocks to rearrange; drop them into columns to place them side by side.
      </p>
      <SectionTitle>Layout</SectionTitle>
      <Field label="Align everything">
        <Segmented<Align> label="Signature alignment" value={root.align ?? "left"} onChange={(v) => updateColumn(root.id, { align: v })} options={ALIGN} />
      </Field>
      <Slider label="Space between blocks" unit="px" min={0} max={30} value={root.gap} onChange={(v) => updateColumn(root.id, { gap: v }, "gap")} />
      <ScaleControl />
      <DirectionControl />
      <Slider
        label="Max width"
        unit="px"
        min={320}
        max={680}
        step={10}
        value={width}
        onChange={(v) => edit((d) => void (d.design.width = v), "design.width")}
      />
      <BoxEditor label="Background panel" value={root.box} onChange={(b, k) => updateColumn(root.id, { box: b }, k)} />
      <SectionTitle>Footer</SectionTitle>
      <MadeWithToggle />
      <SectionTitle>Replies</SectionTitle>
      <ReplyControl />
      <p className="hint" style={{ marginTop: 14 }}>
        Shortcuts: <kbd>Del</kbd> delete · <kbd>⌘D</kbd> duplicate · <kbd>Alt ↑↓</kbd> move · <kbd>Esc</kbd> deselect · <kbd>⌘Z</kbd> undo
      </p>
    </>
  );
}

/** Two or more blocks selected: change them together. */
function GroupInspector({ ids }: { ids: string[] }) {
  const design = useStudio((s) => s.doc!.design);
  const root = useStudio(treeOf)!;
  const blocks = ids.map((id) => findBlock(root, id)?.block).filter((b): b is Block => !!b);
  const same = <T,>(f: (b: Block) => T): T | undefined => (blocks.every((b) => f(b) === f(blocks[0])) ? f(blocks[0]) : undefined);
  const setStyle = (patch: Partial<BlockStyle>, key?: string) => updateSelected((x) => void (x.style = { ...x.style, ...patch }), key);
  return (
    <>
      <div className="insp-head">
        <h3 className="insp-title" data-testid="group-title">
          {blocks.length} blocks selected
        </h3>
        <button className="icon-btn sm" onClick={duplicateSelected} aria-label="Duplicate blocks" title="Duplicate">
          <Copy size={15} />
        </button>
        <button className="icon-btn sm" onClick={removeSelected} aria-label="Delete blocks" title="Delete">
          <Trash2 size={15} />
        </button>
        <button className="icon-btn sm" onClick={() => ui({ selected: null })} aria-label="Deselect" title="Done">
          <X size={15} />
        </button>
      </div>
      <p className="hint">Shift- or ⌘-click blocks on the canvas or in Layers to add or remove them.</p>
      <div className="row" style={{ flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        <button className="btn sm" onClick={() => wrapSelected("columns")} disabled={blocks.length > 4} data-testid="group-columns">
          Side by side
        </button>
        <button className="btn sm" onClick={() => wrapSelected("panel")} data-testid="group-panel">
          Group in a panel
        </button>
      </div>
      <SectionTitle>Size</SectionTitle>
      <div className="row" style={{ flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        <button className="btn sm" onClick={() => resizeSelection({ scale: 0.9 })} data-testid="group-smaller">
          <Minus size={14} /> Smaller
        </button>
        <button className="btn sm" onClick={() => resizeSelection({ scale: 1.1 })} data-testid="group-larger">
          <Plus size={14} /> Larger
        </button>
        <button
          className="btn sm"
          onClick={() => resizeSelection("match") || toast("Pick blocks of the same kind to match their size", "info")}
          title="Make them the same size as the first one you selected"
          data-testid="group-match"
        >
          Match size
        </button>
      </div>
      <SectionTitle>Style</SectionTitle>
      <Field label="Alignment">
        <Segmented<Align> label="Alignment" value={same((b) => b.style?.align ?? "left") ?? "left"} onChange={(v) => setStyle({ align: v })} options={ALIGN} />
      </Field>
      <ColorField
        label="Text colour"
        value={same((b) => b.style?.color) ?? design.text}
        onChange={(c) => setStyle({ color: c }, "color")}
        extra={[design.text, design.accent, design.muted]}
      />
      <Select
        label="Font"
        value={same((b) => b.style?.font ?? "") ?? ""}
        options={[{ value: "", label: "Signature default" }, ...FONTS.map((f) => ({ value: f.id, label: f.label }))]}
        onChange={(v) => setStyle({ font: v || undefined })}
      />
      <Slider
        label="Text size"
        unit="px"
        min={9}
        max={28}
        value={same((b) => b.style?.fontSize) ?? design.fontSize}
        onChange={(v) => setStyle({ fontSize: v }, "size")}
      />
      <button className="btn sm ghost" onClick={() => updateSelected((x) => void (x.style = { align: x.style?.align, box: x.style?.box }))}>
        Reset to signature style
      </button>
      <SectionTitle>Show in</SectionTitle>
      <Segmented
        label="Show in"
        value={same((b) => b.visibility ?? "both") ?? "both"}
        onChange={(v) => updateSelected((b) => void (b.visibility = v === "both" ? undefined : v))}
        options={[
          { value: "both", label: "Both" },
          { value: "full", label: "New", title: "New emails only" },
          { value: "reply", label: "Replies" },
          { value: "hidden", label: "Hidden" },
        ]}
      />
    </>
  );
}

export function Inspector() {
  const root = useStudio(treeOf);
  const selected = useStudio((s) => s.selected);
  const multi = useStudio((s) => s.multi);
  const design = useStudio((s) => s.doc!.design);
  const [peek, setPeek] = useState(false);
  // Phones: the inspector is a bottom sheet; the grip folds it down to its header and back.
  const grip = (
    <button
      type="button"
      className="sheet-grip"
      aria-label={peek ? "Show all settings" : "Fold settings down"}
      aria-expanded={!peek}
      onClick={() => setPeek(!peek)}
      onPointerDown={(e) => {
        const y0 = e.clientY;
        const up = (ev: PointerEvent) => {
          window.removeEventListener("pointerup", up);
          if (Math.abs(ev.clientY - y0) > 24) setPeek(ev.clientY > y0);
        };
        window.addEventListener("pointerup", up);
      }}
      data-testid="sheet-grip"
    >
      <i />
    </button>
  );
  const sheet = peek ? " sheet-peek" : "";
  if (multi.length > 1 && root)
    return (
      <aside className={`inspector${sheet}`} aria-label="Inspector" data-testid="inspector">
        {grip}
        <GroupInspector ids={multi} />
      </aside>
    );
  const hit = root && selected ? findBlock(root, selected) : null;
  const columnSel = root && selected && !hit ? findColumn(root, selected) : null;
  return (
    <aside className={`inspector${hit || columnSel ? sheet : " idle"}`} aria-label="Inspector" data-testid="inspector">
      {(hit || columnSel) && grip}
      {!hit && !columnSel && <SignatureSettings />}
      {hit && (
        <>
          <div className="insp-head">
            <h3 className="insp-title">{blockLabel(hit.block)}</h3>
            <button className="icon-btn sm" onClick={duplicateSelected} aria-label="Duplicate block" title="Duplicate">
              <Copy size={15} />
            </button>
            <button className="icon-btn sm" onClick={removeSelected} aria-label="Delete block" title="Delete">
              <Trash2 size={15} />
            </button>
            <button className="icon-btn sm" onClick={() => ui({ selected: null })} aria-label="Deselect" title="Done">
              <X size={15} />
            </button>
          </div>
          <Breadcrumb id={hit.block.id} label={blockLabel(hit.block)} />
          <Section id="content" title="Content">
            <Content b={hit.block} />
          </Section>
          <Section id="style" title="Style" summary={styleSummary(hit.block, design)}>
            <StyleEditor b={hit.block} />
          </Section>
          {hit.block.type !== "row" && (
            <Section
              id="panel"
              title="Panel"
              defaultOpen={false}
              summary={
                hit.block.style?.box?.background ? `${hit.block.style.box.background.toUpperCase()} · ${hit.block.style.box.padding ?? 0}px padding` : "None"
              }
            >
              <BoxEditor
                value={hit.block.style?.box}
                onChange={(box, k) => updateBlock(hit.block.id, (x) => void (x.style = { ...x.style, box }), k ? `box.${k}` : undefined)}
              />
            </Section>
          )}
          <Section
            id="more"
            title="Visibility & hover"
            defaultOpen={false}
            summary={[SHOW_IN[hit.block.visibility ?? "both"], hit.block.hover ? "hover text" : ""].filter(Boolean).join(" · ")}
          >
            {HOVERABLE.has(hit.block.type) && (
              <TextField
                label="Hover text"
                placeholder="Shown when someone points at it"
                value={hit.block.hover ?? ""}
                onChange={(v) => updateBlock(hit.block.id, { hover: v || undefined }, "hover")}
                testId="inspector-hover"
              />
            )}
            <Field label="Show in">
              <Segmented
                label="Show in"
                value={hit.block.visibility ?? "both"}
                onChange={(v) => updateBlock(hit.block.id, { visibility: v === "both" ? undefined : v })}
                options={[
                  { value: "both", label: "Both" },
                  { value: "full", label: "New", title: "New emails only" },
                  { value: "reply", label: "Replies" },
                  { value: "hidden", label: "Hidden" },
                ]}
              />
            </Field>
          </Section>
        </>
      )}
      {columnSel && root && (
        <>
          <div className="insp-head">
            <h3 className="insp-title">Column</h3>
            <button className="icon-btn sm" onClick={() => ui({ selected: null })} aria-label="Deselect" title="Done">
              <X size={15} />
            </button>
          </div>
          <Breadcrumb id={columnSel.id} label="Column" />
          <ColumnEditor column={columnSel} index={columnIndex(root, columnSel.id)} />
        </>
      )}
    </aside>
  );
}
