import { cropRect } from "../core/crop";
import { edit, ui, useStudio } from "../store/editor";
import { Modal, Slider } from "../ui/kit";
import { previewSource } from "../ui/samples";

export function CropDialog() {
  const open = useStudio((s) => s.dialog === "crop");
  const slot = (useStudio((s) => s.dialogArg) ?? "photo") as "photo" | "logo";
  const doc = useStudio((s) => s.doc);
  const close = () => ui({ dialog: null });
  const image = doc?.images[slot];
  const meta = image?.assetId ? doc!.assets[image.assetId] : null;
  const src = image?.assetId ? previewSource(image.assetId) : null;
  const size = 220;
  let pic = null;
  if (image && meta && src) {
    const rect = cropRect(meta.width, meta.height, 1, image.crop);
    const k = size / rect.sw;
    pic = (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: image.shape === "circle" ? "50%" : image.shape === "rounded" ? 26 : 0,
          overflow: "hidden",
          position: "relative",
          margin: "0 auto 18px",
          boxShadow: "var(--shadow-2)",
        }}
      >
        <img
          src={src}
          alt=""
          style={{ position: "absolute", maxWidth: "none", left: -rect.sx * k, top: -rect.sy * k, width: meta.width * k, height: meta.height * k }}
        />
      </div>
    );
  }
  const set = (patch: Partial<{ x: number; y: number; zoom: number }>) => edit((d) => void Object.assign(d.images[slot].crop, patch), `crop.${slot}`);
  return (
    <Modal
      open={open}
      onClose={close}
      title="Adjust photo"
      subtitle="Zoom and position your headshot."
      footer={
        <button className="btn primary" onClick={close}>
          Done
        </button>
      }
    >
      {pic}
      {image && (
        <>
          <Slider label="Zoom" unit="×" min={1} max={3} step={0.05} value={image.crop.zoom} onChange={(v) => set({ zoom: v })} />
          <Slider label="Left – right" min={-1} max={1} step={0.02} value={image.crop.x} onChange={(v) => set({ x: v })} />
          <Slider label="Up – down" min={-1} max={1} step={0.02} value={image.crop.y} onChange={(v) => set({ y: v })} />
          <button className="btn sm ghost" onClick={() => set({ x: 0, y: 0, zoom: 1 })}>
            Reset
          </button>
        </>
      )}
    </Modal>
  );
}
