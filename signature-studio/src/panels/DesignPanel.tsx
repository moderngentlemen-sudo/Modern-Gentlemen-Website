import { FONTS, fontDef } from "../core/fonts";
import type { ContactIcons, Design } from "../core/types";
import { edit, ui, useStudio } from "../store/editor";
import { applyBrand } from "../core/apply";
import { EARLY_ACCESS, entitlements } from "../core/plans";
import { BRAND } from "../brand";
import { MAX_SCALE, MIN_SCALE } from "../core/scale";
import { Palette } from "lucide-react";
import { ColorField, Field, Segmented, SectionTitle, Select, Slider, Toggle } from "../ui/kit";

const PALETTES: { name: string; accent: string; text: string; muted: string; surface: string }[] = [
  { name: "Violet", accent: "#5b4cf0", text: "#1d1b2c", muted: "#6b6880", surface: "#f4f2ff" },
  { name: "Ocean", accent: "#0a66c2", text: "#0f1b2d", muted: "#5b6b80", surface: "#eef5fc" },
  { name: "Forest", accent: "#2f6b4f", text: "#16241d", muted: "#5d7266", surface: "#eef5f0" },
  { name: "Ember", accent: "#e4572e", text: "#2a1712", muted: "#7c625a", surface: "#fff1ec" },
  { name: "Rose", accent: "#d63d7a", text: "#2b1420", muted: "#7f5f6d", surface: "#fdeef4" },
  { name: "Gold", accent: "#b08d57", text: "#1f1a14", muted: "#7a6f60", surface: "#f8f3ea" },
  { name: "Mono", accent: "#111111", text: "#111111", muted: "#6b6b6b", surface: "#f2f2f2" },
  { name: "Teal", accent: "#0f9d8f", text: "#0f2422", muted: "#58706d", surface: "#e9f7f5" },
  { name: "Plum", accent: "#6d2e8c", text: "#211428", muted: "#6f5f78", surface: "#f5eefa" },
  { name: "Sunset", accent: "#f08a24", text: "#2a1b0d", muted: "#7d6b5a", surface: "#fff4e8" },
  { name: "Navy", accent: "#1f3a68", text: "#121a2b", muted: "#5f6b80", surface: "#eef1f7" },
  { name: "Neon", accent: "#ff2bd6", text: "#140f2e", muted: "#6b5f8f", surface: "#f8ecff" },
];

const fontOptions = FONTS.map((f) => ({ value: f.id, label: `${f.label}${f.safe ? " ✓" : ""}` }));

function fontHint(id: string) {
  const f = fontDef(id);
  return f.safe ? "Shows as designed everywhere" : `Most inboxes show ${f.seenAs}`;
}

/** One control for the size of the whole signature — text, images, icons and spacing together. */
export function ScaleControl() {
  const scale = useStudio((s) => s.doc!.design.scale ?? 1);
  const set = (v: number) => edit((d) => void (d.design.scale = Math.round(v * 100) / 100), "design.scale");
  return (
    <Field label="Overall size" hint={`${Math.round(scale * 100)}%`}>
      <div className="row">
        <button className="btn sm" onClick={() => set(Math.max(MIN_SCALE, scale - 0.05))} aria-label="Smaller">
          A−
        </button>
        <input
          type="range"
          min={MIN_SCALE}
          max={MAX_SCALE}
          step={0.01}
          value={scale}
          onChange={(e) => set(Number(e.target.value))}
          style={{ flex: 1, accentColor: "var(--brand)" }}
          aria-label="Overall size"
          data-testid="scale"
        />
        <button className="btn sm" onClick={() => set(Math.min(MAX_SCALE, scale + 0.05))} aria-label="Bigger">
          A+
        </button>
        {scale !== 1 && (
          <button className="btn sm ghost" onClick={() => set(1)}>
            Reset
          </button>
        )}
      </div>
    </Field>
  );
}

/** The "Made with" link switch — shared by the Design panel and the builder. */
export function MadeWithToggle() {
  const madeWith = useStudio((s) => s.doc!.madeWith !== false);
  const canRemove = entitlements().removeBadge;
  return (
    <Toggle
      label={`Show “${BRAND.madeWith}”`}
      hint={
        canRemove
          ? EARLY_ACCESS
            ? `A small link under new emails that helps others find ${BRAND.name}. Turning it off is free during early access.`
            : `A small link under new emails that helps others find ${BRAND.name}.`
          : `Upgrade to Pro to remove it.`
      }
      checked={madeWith}
      onChange={(v) => (v || canRemove) && edit((doc) => void (doc.madeWith = v))}
      testId="made-with"
    />
  );
}

export function DesignPanel() {
  const d = useStudio((s) => s.doc!.design);
  const reply = useStudio((s) => s.doc!.reply);
  const brand = useStudio((s) => s.prefs.brand);
  const set = <K extends keyof Design>(k: K, v: Design[K], coalesce = true) => edit((doc) => void (doc.design[k] = v), coalesce ? `design.${k}` : undefined);
  return (
    <>
      <h2>Design</h2>
      <p className="lede">Fine-tune colours, type and spacing.</p>
      {brand ? (
        <button className="btn sm" style={{ marginBottom: 6 }} onClick={() => edit((doc) => applyBrand(doc, brand))} data-testid="apply-brand">
          <Palette size={14} /> Apply my brand kit
        </button>
      ) : (
        <button className="btn sm ghost" style={{ marginBottom: 6 }} onClick={() => ui({ dialog: "brand" })}>
          <Palette size={14} /> Set up a brand kit
        </button>
      )}
      <SectionTitle>Palettes</SectionTitle>
      <div className="palette-grid">
        {PALETTES.map((p) => (
          <button
            key={p.name}
            className="palette"
            onClick={() =>
              edit((doc) => {
                Object.assign(doc.design, { accent: p.accent, text: p.text, muted: p.muted, surface: p.surface });
              })
            }
          >
            <div>
              <i style={{ background: p.accent }} />
              <i style={{ background: p.text }} />
              <i style={{ background: p.muted }} />
              <i style={{ background: p.surface }} />
            </div>
            <small>{p.name}</small>
          </button>
        ))}
      </div>
      <SectionTitle>Colours</SectionTitle>
      <ColorField label="Accent" value={d.accent} onChange={(v) => set("accent", v)} />
      <ColorField label="Text" value={d.text} onChange={(v) => set("text", v)} swatches={["#111111", "#1d1b2c", "#1f2937", "#2b1d16", "#0f1b2d", "#333333"]} />
      <ColorField
        label="Secondary text"
        value={d.muted}
        onChange={(v) => set("muted", v)}
        swatches={["#6b6880", "#6b7280", "#7a6458", "#5b6b80", "#888888", "#9a8f80"]}
      />
      <ColorField
        label="Panel"
        value={d.surface}
        onChange={(v) => set("surface", v)}
        swatches={["#ffffff", "#f4f2ff", "#f2f2f2", "#f8f3ea", "#eef5fc", "#111111"]}
      />

      <SectionTitle>Typography</SectionTitle>
      <Select label="Name font" hint={fontHint(d.headingFont)} value={d.headingFont} options={fontOptions} onChange={(v) => set("headingFont", v, false)} />
      <Select label="Body font" hint={fontHint(d.bodyFont)} value={d.bodyFont} options={fontOptions} onChange={(v) => set("bodyFont", v, false)} />
      <Slider label="Text size" unit="px" min={11} max={16} value={d.fontSize} onChange={(v) => set("fontSize", v)} />
      <Slider label="Name size" unit="×" min={1} max={2.4} step={0.05} value={d.nameScale} onChange={(v) => set("nameScale", v)} />
      <div className="field">
        <span className="label">Name style</span>
        <Segmented
          label="Name case"
          value={d.nameCase}
          onChange={(v) => set("nameCase", v, false)}
          options={[
            { value: "normal", label: "Aa Normal" },
            { value: "upper", label: "AA Capitals" },
          ]}
        />
      </div>

      <SectionTitle>Layout</SectionTitle>
      <div className="field">
        <span className="label">Contact labels</span>
        <Segmented<ContactIcons>
          label="Contact labels"
          value={d.contactIcons}
          onChange={(v) => set("contactIcons", v, false)}
          options={[
            { value: "icons", label: "Icons" },
            { value: "letters", label: "P · E" },
            { value: "words", label: "Words" },
            { value: "none", label: "None" },
          ]}
        />
      </div>
      <Toggle label="Contacts on one line" checked={d.contactInline} onChange={(v) => set("contactInline", v, false)} />
      <div className="field">
        <span className="label">Divider</span>
        <Segmented
          label="Divider"
          value={d.divider}
          onChange={(v) => set("divider", v, false)}
          options={[
            { value: "line", label: "Line" },
            { value: "accent", label: "Accent" },
            { value: "dots", label: "Dots" },
            { value: "none", label: "None" },
          ]}
        />
      </div>
      <div className="field">
        <span className="label">Alignment</span>
        <Segmented
          label="Alignment"
          value={d.align}
          onChange={(v) => set("align", v, false)}
          options={[
            { value: "left", label: "Left" },
            { value: "center", label: "Centre" },
          ]}
        />
      </div>
      <Slider label="Spacing" unit="×" min={0.7} max={1.6} step={0.05} value={d.spacing} onChange={(v) => set("spacing", v)} />
      <ScaleControl />
      <Slider label="Max width" unit="px" min={320} max={640} step={10} value={d.width} onChange={(v) => set("width", v)} />

      <SectionTitle>Footer</SectionTitle>
      <MadeWithToggle />

      <SectionTitle>Reply version</SectionTitle>
      <Toggle
        label="Use a compact reply signature"
        hint="Recommended — keeps long threads light"
        checked={reply.compact}
        onChange={(v) => edit((doc) => void (doc.reply.compact = v))}
      />
      <Toggle label="Photo in replies" checked={reply.keepPhoto} onChange={(v) => edit((doc) => void (doc.reply.keepPhoto = v))} />
      <Toggle label="Logo in replies" checked={reply.keepLogo} onChange={(v) => edit((doc) => void (doc.reply.keepLogo = v))} />
      <Toggle label="Social icons in replies" checked={reply.keepSocial} onChange={(v) => edit((doc) => void (doc.reply.keepSocial = v))} />
    </>
  );
}
