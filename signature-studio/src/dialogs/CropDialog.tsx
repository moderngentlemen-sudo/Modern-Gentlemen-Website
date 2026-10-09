/**
 * Zoom and position an image inside its frame — the headshot, the logo, or
 * any image block. Drag to pan, scroll (or use the slider) to zoom.
 */
import { useRef } from "react";
import { findBlock } from "../core/blocks";
import { cropRect } from "../core/crop";
import type { SignatureDoc } from "../core/types";
import { edit, ui, useStudio } from "../store/editor";
import { Field, Modal, Segmented, Slider } from "../ui/kit";
import { previewSource } from "../ui/samples";

type Crop = { x: number; y: number; zoom: number };
type Target = { assetId?: string; crop: Crop; aspect?: number; fixedAspect?: number; round: boolean; title: string };

function target(doc: SignatureDoc, arg: string): Target | null {
  if (arg === "photo" || arg === "logo") {
    const slot = doc.images[arg];
    return {
      assetId: slot.assetId,
      crop: slot.crop,
      aspect: slot.aspect,
      fixedAspect: arg === "photo" ? 1 : undefined,
      round: arg === "photo" && slot.shape === "circle",
      title: arg === "photo" ? "Adjust photo" : "Adjust logo",
    };
  }
  const id = arg.replace(/^block:/, "");
  const hit = doc.blocks ? findBlock(doc.blocks, id) : null;
  if (!hit || hit.block.type !== "image") return null;
  return { assetId: hit.block.assetId, crop: hit.block.crop ?? { x: 0, y: 0, zoom: 1 }, aspect: hit.block.aspect, round: false, title: "Adjust image" };
}

function write(arg: string, patch: { crop?: Partial<Crop>; aspect?: number | null }, key?: string) {
  edit(
    (d) => {
      const apply = (o: { crop?: Crop; aspect?: number }) => {
        if (patch.crop) o.crop = { ...(o.crop ?? { x: 0, y: 0, zoom: 1 }), ...patch.crop };
        if (patch.aspect !== undefined) o.aspect = patch.aspect ?? undefined;
      };
      if (arg === "photo" || arg === "logo") apply(d.images[arg]);
      else {
        const hit = d.blocks ? findBlock(d.blocks, arg.replace(/^block:/, "")) : null;
        if (hit && hit.block.type === "image") apply(hit.block);
      }
    },
    key ? `crop.${arg}.${key}` : undefined,
  );
}

const ASPECTS = [
  { value: "0", label: "Original" },
  { value: "1", label: "Square" },
  { value: "1.3333", label: "4:3" },
  { value: "1.7778", label: "16:9" },
  { value: "3", label: "Wide" },
];

export function CropDialog() {
  const open = useStudio((s) => s.dialog === "crop");
  const arg = useStudio((s) => s.dialogArg) ?? "photo";
  const doc = useStudio((s) => s.doc);
  const drag = useRef<{ x: number; y: number; crop: Crop } | null>(null);
  const close = () => ui({ dialog: null, dialogArg: null });
  const t = doc && open ? target(doc, arg) : null;
  const meta = t?.assetId ? doc!.assets[t.assetId] : null;
  const src = t?.assetId ? previewSource(t.assetId) : null;

  let stage = null;
  if (t && meta && src) {
    const aspect = t.fixedAspect ?? t.aspect ?? meta.width / meta.height;
    let w = 320;
    let h = w / aspect;
    if (h > 240) {
      h = 240;
      w = h * aspect;
    }
    const rect = cropRect(meta.width, meta.height, aspect, t.crop);
    const k = w / rect.sw;
    const maxX = (meta.width - rect.sw) / 2;
    const maxY = (meta.height - rect.sh) / 2;
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    stage = (
      <div
        className="crop-stage"
        style={{ width: w, height: h, borderRadius: t.round ? "50%" : 10 }}
        data-testid="crop-stage"
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, crop: { ...t.crop } };
        }}
        onPointerMove={(e) => {
          const g = drag.current;
          if (!g) return;
          const dx = (e.clientX - g.x) / k;
          const dy = (e.clientY - g.y) / k;
          write(arg, { crop: { x: maxX > 0 ? clamp(g.crop.x - dx / maxX) : 0, y: maxY > 0 ? clamp(g.crop.y - dy / maxY) : 0 } }, "pan");
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onWheel={(e) => {
          const zoom = Math.max(1, Math.min(4, t.crop.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08)));
          write(arg, { crop: { zoom: Math.round(zoom * 100) / 100 } }, "zoom");
        }}
      >
        <img src={src} alt="" draggable={false} style={{ left: -rect.sx * k, top: -rect.sy * k, width: meta.width * k, height: meta.height * k }} />
      </div>
    );
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={t?.title ?? "Adjust image"}
      subtitle="Drag to reposition. Scroll or use the slider to zoom."
      testId="crop-dialog"
      footer={
        <button className="btn primary" onClick={close}>
          Done
        </button>
      }
    >
      {stage ?? <p className="muted">Add an image first.</p>}
      {t && meta && (
        <>
          {!t.fixedAspect && (
            <Field label="Frame">
              <Segmented
                label="Frame shape"
                value={String(t.aspect ? (ASPECTS.find((a) => Math.abs(Number(a.value) - t.aspect!) < 0.01)?.value ?? "0") : "0")}
                onChange={(v) => write(arg, { aspect: v === "0" ? null : Number(v), crop: { x: 0, y: 0 } })}
                options={ASPECTS}
              />
            </Field>
          )}
          <Slider label="Zoom" unit="×" min={1} max={4} step={0.05} value={t.crop.zoom} onChange={(v) => write(arg, { crop: { zoom: v } }, "zoom")} />
          <button className="btn sm ghost" onClick={() => write(arg, { crop: { x: 0, y: 0, zoom: 1 } })}>
            Reset
          </button>
        </>
      )}
    </Modal>
  );
}
