import { useEffect, useState } from "react";
import { Pipette, Trash2 } from "lucide-react";
import { FONTS } from "../core/fonts";
import { DEFAULT_DESIGN } from "../core/defaults";
import type { BrandKit } from "../core/types";
import { extractColors } from "../store/assets";
import { toast, ui, updatePrefs, useStudio } from "../store/editor";
import { ImageDrop } from "../ui/ImageDrop";
import { ColorField, Modal, SectionTitle, Select, TextField } from "../ui/kit";

const blank = (): BrandKit => ({
  accent: DEFAULT_DESIGN.accent,
  text: DEFAULT_DESIGN.text,
  muted: DEFAULT_DESIGN.muted,
  surface: DEFAULT_DESIGN.surface,
  headingFont: DEFAULT_DESIGN.headingFont,
  bodyFont: DEFAULT_DESIGN.bodyFont,
});

const fontOptions = FONTS.map((f) => ({ value: f.id, label: `${f.label}${f.safe ? " ✓" : ""}` }));

export function BrandDialog() {
  const open = useStudio((s) => s.dialog === "brand");
  const saved = useStudio((s) => s.prefs.brand);
  const docStyles = useStudio((s) => s.doc?.design.textStyles);
  const [kit, setKit] = useState<BrandKit>(blank);
  useEffect(() => {
    if (open) setKit(saved ? structuredClone(saved) : blank());
  }, [open]);

  const set = (patch: Partial<BrandKit>) => setKit((k) => ({ ...k, ...patch }));
  const close = () => ui({ dialog: null });
  const save = () => {
    updatePrefs({ brand: kit });
    toast("Brand kit saved — new signatures use it", "success");
    close();
  };
  const fromLogo = async () => {
    if (!kit.logo) return;
    const colors = await extractColors(kit.logo.id, 3);
    if (!colors.length) return toast("Couldn't find colours in this logo.", "error");
    set({ accent: colors[0] });
    toast("Accent matched to your logo", "success");
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Brand kit"
      subtitle="Your colours, fonts and logo — applied to new signatures, and to any signature with one click."
      testId="brand-dialog"
      footer={
        <>
          {saved && (
            <button
              className="btn ghost danger"
              onClick={() => {
                updatePrefs({ brand: undefined });
                close();
              }}
            >
              <Trash2 size={15} /> Remove kit
            </button>
          )}
          <div className="grow" />
          <button className="btn" onClick={close}>
            Cancel
          </button>
          <button className="btn primary" onClick={save} data-testid="save-brand">
            Save brand kit
          </button>
        </>
      }
    >
      <div className="grid2" style={{ alignItems: "start" }}>
        <div>
          <SectionTitle>Logo</SectionTitle>
          <div className="image-slot">
            <ImageDrop assetId={kit.logo?.id} label="brand logo" onFile={(m) => set({ logo: m })} />
            {kit.logo && (
              <div style={{ display: "grid", gap: 6 }}>
                <button className="btn sm" onClick={() => void fromLogo()}>
                  <Pipette size={14} /> Match colours
                </button>
                <button className="btn sm ghost danger" onClick={() => set({ logo: undefined })}>
                  Remove
                </button>
              </div>
            )}
          </div>
          <TextField label="Company" value={kit.company ?? ""} onChange={(v) => set({ company: v })} placeholder="Modern Gentlemen" />
          <TextField label="Website" value={kit.website ?? ""} onChange={(v) => set({ website: v })} placeholder="company.com" />
          <SectionTitle>Fonts</SectionTitle>
          <Select label="Headings" value={kit.headingFont} options={fontOptions} onChange={(v) => set({ headingFont: v })} />
          <Select label="Body" value={kit.bodyFont} options={fontOptions} onChange={(v) => set({ bodyFont: v })} />
          <SectionTitle>Text styles</SectionTitle>
          <p className="hint">
            {kit.textStyles?.length ? kit.textStyles.map((t) => t.name).join(", ") : "None yet. Save text styles in a signature, then add them here."}
          </p>
          {!!docStyles?.length && (
            <button className="btn sm" onClick={() => set({ textStyles: structuredClone(docStyles) })} data-testid="brand-styles">
              Use this signature's {docStyles.length} text style{docStyles.length > 1 ? "s" : ""}
            </button>
          )}
        </div>
        <div>
          <SectionTitle>Colours</SectionTitle>
          <ColorField label="Accent" value={kit.accent} onChange={(v) => set({ accent: v })} />
          <ColorField label="Text" value={kit.text} onChange={(v) => set({ text: v })} swatches={["#111111", "#1d1b2c", "#1f2937", "#2b1d16", "#0f1b2d"]} />
          <ColorField
            label="Secondary text"
            value={kit.muted}
            onChange={(v) => set({ muted: v })}
            swatches={["#6b6880", "#6b7280", "#7a6458", "#5b6b80", "#888888"]}
          />
          <ColorField
            label="Panel"
            value={kit.surface}
            onChange={(v) => set({ surface: v })}
            swatches={["#ffffff", "#f4f2ff", "#f2f2f2", "#f8f3ea", "#eef5fc"]}
          />
        </div>
      </div>
    </Modal>
  );
}
