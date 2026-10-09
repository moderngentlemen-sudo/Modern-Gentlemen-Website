import { Pipette } from "lucide-react";
import { extractColors } from "../store/assets";
import { edit, toast, useStudio } from "../store/editor";
import { ImageStudio } from "../builder/ImageStudio";
import { SectionTitle, Slider, TextField } from "../ui/kit";

type Slot = "photo" | "logo";

function SlotEditor({ slot }: { slot: Slot }) {
  const image = useStudio((s) => s.doc!.images[slot]);
  return (
    <>
      <span className="hint">{slot === "photo" ? "A friendly, well-lit photo works best." : "PNG with a transparent background is ideal."}</span>
      <ImageStudio arg={slot} uploadTestId={`upload-${slot}`} editTestId={`adjust-${slot}`} />
      {image.assetId && (
        <>
          <Slider
            label="Size"
            unit="px"
            min={40}
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
      <SectionTitle>Headshot</SectionTitle>
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
