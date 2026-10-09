/**
 * The image inspector, the same for the headshot, the logo and image blocks:
 * replace (upload or from the library), open the editor, and frame it —
 * shape, corner radius, border, ring, shadow and backing colour.
 */
import { useEffect, useRef, useState } from "react";
import { Images, SlidersHorizontal, Trash2, X } from "lucide-react";
import { FRAME_SHAPES, type FrameShape, type ImageLook } from "../core/imageLook";
import type { AssetMeta } from "../core/types";
import { hydrateSources } from "../store/assets";
import { forgetImage, libraryList } from "../store/library";
import { ui, useStudio } from "../store/editor";
import { ImageDrop } from "../ui/ImageDrop";
import { ColorField, Field, Segmented, Slider, Toggle } from "../ui/kit";
import { previewSource } from "../ui/samples";
import { readImage, writeImage, type ImageArg } from "./imageTarget";

/** Pick a previously uploaded image. */
export function LibraryButton({ onPick, testId = "open-library" }: { onPick: (m: AssetMeta) => void; testId?: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AssetMeta[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    let live = true;
    void libraryList().then(async (list) => {
      const missing = new Set(await hydrateSources(list.map((m) => m.id)));
      if (live) setItems(list.filter((m) => !missing.has(m.id)));
    });
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("pointerdown", close);
    return () => {
      live = false;
      window.removeEventListener("pointerdown", close);
    };
  }, [open]);
  return (
    <div className="library" ref={ref}>
      <button type="button" className="btn sm" aria-expanded={open} onClick={() => setOpen(!open)} data-testid={testId}>
        <Images size={14} /> Library
      </button>
      {open && (
        <div className="library-pop" role="dialog" aria-label="Image library">
          {items.length ? (
            <div className="library-grid">
              {items.map((m) => (
                <div key={m.id} className="library-item">
                  <button
                    type="button"
                    title={m.name}
                    aria-label={`Use ${m.name}`}
                    onClick={() => {
                      onPick(m);
                      setOpen(false);
                    }}
                  >
                    <img src={previewSource(m.id) ?? ""} alt="" />
                  </button>
                  <button
                    type="button"
                    className="library-forget"
                    aria-label={`Remove ${m.name} from the library`}
                    onClick={() => void forgetImage(m.id).then(() => setItems((l) => l.filter((x) => x.id !== m.id)))}
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="hint">Images you upload on this device appear here, ready to reuse in any signature.</p>
          )}
        </div>
      )}
    </div>
  );
}

export function ImageStudio({ arg, uploadTestId, editTestId }: { arg: ImageArg; uploadTestId?: string; editTestId?: string }) {
  const doc = useStudio((s) => s.doc);
  const t = doc ? readImage(doc, arg) : null;
  if (!t || !doc) return null;
  const look = t.look;
  const has = !!t.assetId;
  const setLook = (l: Partial<ImageLook>, key?: string) => writeImage(arg, { look: l }, key);
  const replace = (m: AssetMeta) => writeImage(arg, { asset: m, crop: { x: 0, y: 0, zoom: 1 } });
  const maxRadius = Math.round(t.width / 2);
  return (
    <div className="image-studio" data-testid="image-studio">
      <div className="image-slot">
        <ImageDrop assetId={t.assetId} onFile={replace} round={t.frame === "circle"} label={t.kind === "image" ? "image" : t.kind} testId={uploadTestId} />
        <div className="image-actions">
          {has && (
            <button className="btn sm primary" onClick={() => ui({ dialog: "crop", dialogArg: arg })} data-testid={editTestId}>
              <SlidersHorizontal size={14} /> Edit image
            </button>
          )}
          <LibraryButton onPick={replace} />
          {has && (
            <button className="btn sm ghost danger" onClick={() => writeImage(arg, { remove: true })} aria-label={`Remove ${t.kind}`}>
              <Trash2 size={14} /> Remove
            </button>
          )}
        </div>
      </div>
      {has && (
        <>
          <Field label="Frame">
            <Segmented<FrameShape> label="Frame shape" value={t.frame} onChange={(v) => setLook({ frame: v })} options={FRAME_SHAPES} />
          </Field>
          {t.frame === "rounded" && (
            <Slider
              label="Corner radius"
              unit="px"
              min={0}
              max={maxRadius}
              value={look.radius ?? Math.round(t.width * 0.12)}
              onChange={(v) => setLook({ radius: v }, "radius")}
            />
          )}
          <Slider label="Border" unit="px" min={0} max={12} value={look.border ?? 0} onChange={(v) => setLook({ border: v || undefined }, "border")} />
          {!!look.border && (
            <>
              <ColorField label="Border colour" value={look.borderColor ?? doc.design.accent} onChange={(c) => setLook({ borderColor: c }, "bc")} />
              <Slider label="Ring gap" unit="px" min={0} max={12} value={look.gap ?? 0} onChange={(v) => setLook({ gap: v || undefined }, "gap")} />
            </>
          )}
          <Toggle
            label="Shadow"
            hint="A soft drop shadow, baked into the image"
            checked={!!look.shadow}
            onChange={(v) => setLook({ shadow: v || undefined })}
            testId="image-shadow"
          />
          <Toggle
            label="Backing colour"
            hint="Fills behind transparent logos and ring gaps"
            checked={!!look.backing}
            onChange={(v) => setLook({ backing: v ? "#ffffff" : undefined, inset: v ? look.inset : undefined })}
          />
          {look.backing && (
            <>
              <ColorField label="Backing" value={look.backing} onChange={(c) => setLook({ backing: c }, "backing")} />
              <Slider label="Padding" unit="px" min={0} max={24} value={look.inset ?? 0} onChange={(v) => setLook({ inset: v || undefined }, "inset")} />
            </>
          )}
        </>
      )}
    </div>
  );
}
