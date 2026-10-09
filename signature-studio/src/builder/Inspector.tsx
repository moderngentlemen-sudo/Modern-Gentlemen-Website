import type { ReactNode } from "react";
import { Copy, Minus, Plus, Trash2, X } from "lucide-react";
import { col, findBlock, findColumn } from "../core/blocks";
import { FONTS } from "../core/fonts";
import type { Align, Block, BlockStyle, Box, ButtonStyle, Column, DetailKey } from "../core/types";
import { edit, ui, useStudio, type Tab } from "../store/editor";
import { ImageDrop } from "../ui/ImageDrop";
import { ColorField, Field, Segmented, SectionTitle, Select, Slider, TextField, Toggle } from "../ui/kit";
import { MadeWithToggle } from "../panels/DesignPanel";
import { duplicateSelected, removeSelected, updateBlock, updateColumn } from "./actions";
import { blockLabel } from "./catalog";

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
      {textual && (
        <>
          <ColorField
            label="Text colour"
            value={st.color ?? design.text}
            onChange={(c) => setStyle({ color: c }, "color")}
            extra={[design.text, design.accent, design.muted]}
          />
          <Select
            label="Font"
            value={st.font ?? ""}
            options={[{ value: "", label: "Signature default" }, ...FONTS.map((f) => ({ value: f.id, label: f.label }))]}
            onChange={(v) => setStyle({ font: v || undefined })}
          />
          <Slider label="Text size" unit="px" min={9} max={28} value={st.fontSize ?? design.fontSize} onChange={(v) => setStyle({ fontSize: v }, "size")} />
        </>
      )}
      {["contacts", "socials", "button", "monogram", "divider", "reviews", "quote", "name"].includes(b.type) && (
        <ColorField label="Accent colour" value={st.accent ?? design.accent} onChange={(c) => setStyle({ accent: c }, "accent")} extra={[design.accent]} />
      )}
      {(st.color || st.font || st.fontSize || st.accent) && (
        <button className="btn sm ghost" onClick={() => updateBlock(b.id, (x) => void (x.style = { align: x.style?.align, box: x.style?.box }))}>
          Reset to signature style
        </button>
      )}
      {b.type !== "row" && <BoxEditor value={st.box} onChange={(box, k) => setStyle({ box }, k ? `box.${k}` : undefined)} />}
    </>
  );
}

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
          <p className="hint">
            Shows “{details.name || "your name"}”. <GoTo tab="details">Edit details</GoTo>
          </p>
          <Slider label="Size" unit="×" min={0.7} max={2.2} step={0.05} value={b.scale ?? 1} onChange={(v) => set({ scale: v }, "scale")} />
          <Toggle label="Capitals" checked={!!b.upper} onChange={(v) => set({ upper: v })} />
          <Toggle label="Accent underline" checked={!!b.underline} onChange={(v) => set({ underline: v })} />
        </>
      );
    case "title":
      return (
        <>
          <p className="hint">
            Shows your title, department and company. <GoTo tab="details">Edit details</GoTo>
          </p>
          <Toggle label="Job title only" checked={!!b.titleOnly} onChange={(v) => set({ titleOnly: v })} />
          <Toggle label="Capitals" checked={!!b.upper} onChange={(v) => set({ upper: v })} />
          <Toggle label="Italic" checked={!!b.italic} onChange={(v) => set({ italic: v })} />
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
          <Toggle label="Small capitals" checked={!!b.upper} onChange={(v) => set({ upper: v })} />
        </>
      );
    case "text":
      return (
        <>
          <TextField label="Text" multiline value={b.text} onChange={(v) => set({ text: v }, "text")} testId="inspector-text" />
          <Toggle label="Bold" checked={!!b.bold} onChange={(v) => set({ bold: v })} />
          <Toggle label="Italic" checked={!!b.italic} onChange={(v) => set({ italic: v })} />
          <Toggle label="Secondary colour" checked={!!b.muted} onChange={(v) => set({ muted: v })} />
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
          <p className="hint">
            Icon style is set in Design. <GoTo tab="details">Edit contact details</GoTo>
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
          <GoTo tab="images">{b.type === "photo" ? "Change photo" : "Change logo"}</GoTo>
        </>
      );
    case "image":
      return (
        <>
          <Field label="Image">
            <ImageDrop
              assetId={b.assetId}
              label="image"
              style={{ width: "100%", height: 90 }}
              onFile={(m) =>
                edit((d) => {
                  d.assets[m.id] = m;
                  const hit = d.blocks && findBlock(d.blocks, b.id);
                  if (hit && hit.block.type === "image") {
                    hit.block.assetId = m.id;
                    hit.block.width = Math.min(m.width, 480);
                  }
                })
              }
            />
          </Field>
          <Slider label="Width" unit="px" min={40} max={640} step={10} value={b.width} onChange={(v) => set({ width: v }, "width")} />
          <Toggle label="Rounded corners" checked={!!b.radius} onChange={(v) => set({ radius: v ? 8 : 0 })} />
          <TextField label="Link" placeholder="https://…" value={b.link ?? ""} onChange={(v) => set({ link: v }, "link")} />
          <TextField label="Description" hint="for screen readers" value={b.alt ?? ""} onChange={(v) => set({ alt: v }, "alt")} />
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
                  const hit = d.blocks && findBlock(d.blocks, b.id);
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
  const root = useStudio((s) => s.doc!.blocks);
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
      <p className="hint" style={{ marginTop: 14 }}>
        Shortcuts: <kbd>Del</kbd> delete · <kbd>⌘D</kbd> duplicate · <kbd>Alt ↑↓</kbd> move · <kbd>Esc</kbd> deselect · <kbd>⌘Z</kbd> undo
      </p>
    </>
  );
}

export function Inspector() {
  const root = useStudio((s) => s.doc?.blocks);
  const selected = useStudio((s) => s.selected);
  const hit = root && selected ? findBlock(root, selected) : null;
  const columnSel = root && selected && !hit ? findColumn(root, selected) : null;
  return (
    <aside className={`inspector${hit || columnSel ? "" : " idle"}`} aria-label="Inspector" data-testid="inspector">
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
          <Content b={hit.block} />
          <StyleEditor b={hit.block} />
          <SectionTitle>Show in</SectionTitle>
          <Segmented
            label="Show in"
            value={hit.block.visibility ?? "both"}
            onChange={(v) => updateBlock(hit.block.id, { visibility: v === "both" ? undefined : v })}
            options={[
              { value: "both", label: "Both" },
              { value: "full", label: "New emails" },
              { value: "reply", label: "Replies" },
            ]}
          />
        </>
      )}
    </aside>
  );
}
