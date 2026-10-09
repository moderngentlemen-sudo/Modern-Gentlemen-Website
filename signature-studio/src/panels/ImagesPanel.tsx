import { Crop, Pipette, Trash2 } from "lucide-react";
import type { AssetMeta, ImageShape } from "../core/types";
import { extractColors } from "../store/assets";
import { edit, toast, ui, useStudio } from "../store/editor";
import { ImageDrop } from "../ui/ImageDrop";
import { Segmented, SectionTitle, Slider, TextField } from "../ui/kit";

type Slot = "photo" | "logo";

function SlotEditor({ slot }: { slot: Slot }) {
  const image = useStudio((s) => s.doc!.images[slot]);
  const has = !!image.assetId;
  const set = (meta: AssetMeta) =>
    edit((d) => {
      d.assets[meta.id] = meta;
      d.images[slot].assetId = meta.id;
      d.images[slot].crop = { x: 0, y: 0, zoom: 1 };
    });
  return (
    <>
      <div className="image-slot">
        <ImageDrop
          assetId={image.assetId}
          onFile={set}
          round={slot === "photo" && image.shape === "circle"}
          label={slot === "photo" ? "headshot" : "logo"}
          testId={`upload-${slot}`}
        />
        <div style={{ display: "grid", gap: 6 }}>
          <strong>{slot === "photo" ? "Headshot" : "Logo"}</strong>
          <span className="hint">{slot === "photo" ? "A friendly, well-lit photo works best." : "PNG with a transparent background is ideal."}</span>
          {has && (
            <div className="row" style={{ gap: 4 }}>
              <button className="btn sm" onClick={() => ui({ dialog: "crop", dialogArg: slot })} data-testid={`adjust-${slot}`}>
                <Crop size={14} /> Zoom &amp; crop
              </button>
              <button className="btn sm ghost danger" onClick={() => edit((d) => void (d.images[slot].assetId = undefined))}>
                <Trash2 size={14} /> Remove
              </button>
            </div>
          )}
        </div>
      </div>
      {has && (
        <>
          {slot === "photo" && (
            <div className="field">
              <span className="label">Shape</span>
              <Segmented<ImageShape>
                label="Photo shape"
                value={image.shape}
                onChange={(v) => edit((d) => void (d.images.photo.shape = v))}
                options={[
                  { value: "circle", label: "Circle" },
                  { value: "rounded", label: "Rounded" },
                  { value: "square", label: "Square" },
                ]}
              />
            </div>
          )}
          <Slider
            label="Size"
            unit="px"
            min={slot === "photo" ? 40 : 40}
            max={slot === "photo" ? 160 : 220}
            value={image.size}
            onChange={(v) => edit((d) => void (d.images[slot].size = v), `${slot}.size`)}
          />
          <TextField
            label="Link when clicked"
            hint="optional"
            placeholder="https://…"
            value={image.link ?? ""}
            onChange={(v) => edit((d) => void (d.images[slot].link = v || undefined), `${slot}.link`)}
          />
        </>
      )}
    </>
  );
}

export function ImagesPanel() {
  const logo = useStudio((s) => s.doc!.images.logo.assetId);
  const matchLogo = async () => {
    if (!logo) return;
    const colors = await extractColors(logo, 3);
    if (!colors.length) return toast("Couldn't find colours in this logo.", "error");
    edit((d) => {
      d.design.accent = colors[0];
    });
    toast("Accent colour matched to your logo", "success");
  };
  return (
    <>
      <h2>Images</h2>
      <p className="lede">Add a headshot and a logo. We size, crop and host them for you.</p>
      <SlotEditor slot="photo" />
      <SectionTitle>Logo</SectionTitle>
      <SlotEditor slot="logo" />
      {logo && (
        <button className="btn sm" onClick={() => void matchLogo()}>
          <Pipette size={14} /> Match colours to my logo
        </button>
      )}
      <p className="hint" style={{ marginTop: 16 }}>
        Want a banner or a video thumbnail? Find them in Add-ons. Designed a business card in Canva? Open the Card tab.
      </p>
    </>
  );
}
