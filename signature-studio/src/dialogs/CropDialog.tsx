/**
 * The image editor — for the headshot, the logo and any image block.
 *
 * Crop: drag or use the arrow keys to position, scroll / slider / + − to
 * zoom, crop presets, rotate, flip, straighten, a thirds grid and auto-frame.
 * Adjust: brightness, contrast, saturation, warmth and colour presets
 * (including a brand duotone and a one-colour logo), plus logo tools.
 *
 * Framing and colour are settings, so they can always be changed back.
 * Rotating, flipping and straightening make a new copy of the picture that
 * remembers its original, so they can be undone or changed later too.
 */
import { useEffect, useRef, useState } from "react";
import { FlipHorizontal2, FlipVertical2, Grid3x3, Loader2, RotateCcw, RotateCw, ScanFace, Scissors, Undo2, Eraser, UserRound } from "lucide-react";
import { cropRect } from "../core/crop";
import { framePath, lookMatrix, matrixValues, PRESETS, shapeRadius, straightenScale, type ImageLook, type LookPreset } from "../core/imageLook";
import type { AssetOrigin } from "../core/types";
import { readImage, writeImage } from "../builder/imageTarget";
import { orientAsset, originOf, subjectCenter, trimImage, UploadError } from "../store/assets";
import { cutOutPerson, removeFlatBackground } from "../store/cutout";
import { toast, ui, undo, useStudio } from "../store/editor";
import { ColorField, Field, Modal, Segmented, Slider } from "../ui/kit";
import { previewSource } from "../ui/samples";

type Crop = { x: number; y: number; zoom: number };

const ASPECTS = [
  { value: "0", label: "Original" },
  { value: "1", label: "Square" },
  { value: "0.8", label: "4:5" },
  { value: "1.3333", label: "4:3" },
  { value: "1.7778", label: "16:9" },
  { value: "3", label: "Banner" },
];

const clamp = (v: number, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, v));
const round2 = (v: number) => Math.round(v * 100) / 100;

export function CropDialog() {
  const open = useStudio((s) => s.dialog === "crop");
  const arg = useStudio((s) => s.dialogArg) ?? "photo";
  const doc = useStudio((s) => s.doc);
  const drag = useRef<{ x: number; y: number; crop: Crop } | null>(null);
  const [tab, setTab] = useState<"crop" | "adjust">("crop");
  const [grid, setGrid] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tilt, setTilt] = useState<number | null>(null);
  const tiltTimer = useRef<number | undefined>(undefined);
  const close = () => ui({ dialog: null, dialogArg: null });
  const t = doc && open ? readImage(doc, arg) : null;
  const meta = t?.assetId ? doc!.assets[t.assetId] : null;
  const src = t?.assetId ? previewSource(t.assetId) : null;
  const origin = meta && doc ? originOf(meta, doc.assets) : null;
  const ops: Omit<AssetOrigin, "id"> = origin
    ? { rotate: origin.rotate, flipH: origin.flipH, flipV: origin.flipV, straighten: origin.straighten }
    : { rotate: 0 };
  const accent = doc?.design.accent ?? "#000000";
  const look = t?.look ?? {};

  useEffect(() => {
    if (!open) {
      setTab("crop");
      setTilt(null);
    }
  }, [open]);

  const set = (patch: Parameters<typeof writeImage>[1], key?: string) => writeImage(arg, patch, key);
  const setLook = (l: Partial<ImageLook>, key?: string) => set({ look: l }, key ? `look.${key}` : undefined);

  /** Re-make the picture from its original with new rotate/flip/straighten settings. */
  const reorient = async (next: Omit<AssetOrigin, "id">) => {
    if (!meta || !doc) return;
    const base = origin ? doc.assets[origin.id] : meta;
    const plain = !next.rotate && !next.flipH && !next.flipV && !next.straighten;
    setBusy(true);
    try {
      set({ asset: plain ? base : await orientAsset(base, next) });
    } catch (e) {
      toast(e instanceof UploadError ? e.message : "Couldn't change this image.", "error");
    } finally {
      setBusy(false);
      setTilt(null);
    }
  };

  const autoFrame = async () => {
    if (!t?.assetId || !meta) return;
    const c = await subjectCenter(t.assetId);
    if (!c) return toast("Couldn't find a clear subject. Drag to position it instead.", "info");
    const aspect = t.fixedAspect ?? t.aspect ?? meta.width / meta.height;
    const zoom = Math.max(t.crop.zoom, t.kind === "photo" ? 1.15 : 1);
    const r = cropRect(meta.width, meta.height, aspect, { x: 0, y: 0, zoom });
    const maxX = (meta.width - r.sw) / 2;
    const maxY = (meta.height - r.sh) / 2;
    // Centre the subject; for portraits put the face a little above the middle.
    const cx = c.x * meta.width - meta.width / 2;
    const cy = c.y * meta.height - meta.height / 2 + (t.kind === "photo" ? r.sh * 0.08 : 0);
    set({ crop: { x: maxX > 0 ? round2(clamp(cx / maxX)) : 0, y: maxY > 0 ? round2(clamp(cy / maxY)) : 0, zoom: round2(zoom) } });
  };

  const trim = async () => {
    if (!meta) return;
    setBusy(true);
    try {
      const r = await trimImage(meta.id, meta.mime);
      if (!r) toast("There are no empty edges to trim.", "info");
      else {
        set({ asset: { ...r.meta, name: meta.name }, crop: { x: 0, y: 0, zoom: 1 } });
        toast("Empty edges trimmed", "success");
      }
    } finally {
      setBusy(false);
    }
  };

  /** Background removal runs on this device; the result is a new transparent PNG (undo restores the original). */
  const removeBg = async (mode: "flat" | "person") => {
    if (!meta) return;
    setBusy(true);
    try {
      const out = mode === "flat" ? await removeFlatBackground(meta) : await cutOutPerson(meta);
      if (!out) toast("No flat background found. For photos, use Cut out person.", "info");
      else {
        set({ asset: out });
        toast("Background removed", "success", { label: "Undo", run: undo });
      }
    } catch (e) {
      toast(e instanceof UploadError ? e.message : "Couldn't remove the background.", "error");
    } finally {
      setBusy(false);
    }
  };

  let stage = null;
  if (t && meta && src) {
    const aspect = t.fixedAspect ?? t.aspect ?? meta.width / meta.height;
    const maxW = Math.min(440, (typeof window !== "undefined" ? window.innerWidth : 800) - 72);
    let w = maxW;
    let h = w / aspect;
    if (h > 300) {
      h = 300;
      w = h * aspect;
    }
    const rect = cropRect(meta.width, meta.height, aspect, t.crop);
    const k = w / rect.sw;
    const maxX = (meta.width - rect.sw) / 2;
    const maxY = (meta.height - rect.sh) / 2;
    const pan = (dx: number, dy: number, key = "pan") =>
      set({ crop: { x: maxX > 0 ? round2(clamp(t.crop.x + dx)) : 0, y: maxY > 0 ? round2(clamp(t.crop.y + dy)) : 0 } }, key);
    const zoomTo = (z: number) => set({ crop: { zoom: round2(clamp(z, 1, 4)) } }, "zoom");
    const m = lookMatrix(look, accent);
    const outline = framePath(t.frame, 0, 0, w, h, shapeRadius(t.frame, w, h, look.radius === undefined ? undefined : (look.radius * w) / t.width));
    const pending = tilt === null ? 0 : tilt - (ops.straighten ?? 0);
    stage = (
      <div
        className={`crop-stage${grid || dragging ? " show-grid" : ""}`}
        style={{ width: w, height: h, clipPath: t.frame === "square" ? undefined : `path("${outline}")` }}
        data-testid="crop-stage"
        tabIndex={0}
        role="application"
        aria-label="Image framing. Drag or use the arrow keys to move it; plus and minus zoom."
        onKeyDown={(e) => {
          const step = e.shiftKey ? 0.1 : 0.02;
          const map: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
          if (map[e.key]) {
            e.preventDefault();
            e.stopPropagation();
            pan(...map[e.key], "nudge");
          } else if (e.key === "+" || e.key === "=") {
            e.preventDefault();
            zoomTo(t.crop.zoom * 1.08);
          } else if (e.key === "-") {
            e.preventDefault();
            zoomTo(t.crop.zoom / 1.08);
          }
        }}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, crop: { ...t.crop } };
          setDragging(true);
        }}
        onPointerMove={(e) => {
          const g = drag.current;
          if (!g) return;
          const dx = (e.clientX - g.x) / k;
          const dy = (e.clientY - g.y) / k;
          set({ crop: { x: maxX > 0 ? clamp(g.crop.x - dx / maxX) : 0, y: maxY > 0 ? clamp(g.crop.y - dy / maxY) : 0 } }, "pan");
        }}
        onPointerUp={() => {
          drag.current = null;
          setDragging(false);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setDragging(false);
        }}
        onWheel={(e) => zoomTo(t.crop.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08))}
      >
        <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
          {m && (
            <filter id="ed-look" colorInterpolationFilters="sRGB">
              <feColorMatrix type="matrix" values={matrixValues(m)} />
            </filter>
          )}
        </svg>
        {look.backing && <div className="crop-backing" style={{ background: look.backing }} />}
        <img
          src={src}
          alt=""
          draggable={false}
          style={{
            left: -rect.sx * k,
            top: -rect.sy * k,
            width: meta.width * k,
            height: meta.height * k,
            filter: m ? "url(#ed-look)" : undefined,
            transform: pending ? `rotate(${pending}deg) scale(${straightenScale(w, h, pending)})` : undefined,
            transformOrigin: `${rect.sx * k + w / 2}px ${rect.sy * k + h / 2}px`,
          }}
        />
        <div className="crop-grid" aria-hidden="true" />
        {busy && (
          <div className="crop-busy">
            <Loader2 className="spin" size={22} />
          </div>
        )}
      </div>
    );
  }

  const presetThumb = (p: LookPreset) => {
    const pm = lookMatrix({ ...look, preset: p }, accent);
    return (
      <button
        key={p}
        type="button"
        className="preset"
        aria-pressed={(look.preset ?? "none") === p}
        onClick={() => setLook({ preset: p === "none" ? undefined : p })}
        data-testid={`preset-${p}`}
      >
        <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
          {pm && (
            <filter id={`ed-p-${p}`} colorInterpolationFilters="sRGB">
              <feColorMatrix type="matrix" values={matrixValues(pm)} />
            </filter>
          )}
        </svg>
        {src && <img src={src} alt="" style={{ filter: pm ? `url(#ed-p-${p})` : undefined }} />}
        <span>{PRESETS.find((x) => x.value === p)!.label}</span>
      </button>
    );
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={t?.title ?? "Edit image"}
      subtitle={tab === "crop" ? "Drag to reposition. Scroll, pinch or use the slider to zoom." : "Colour changes are saved as settings — reset any time."}
      testId="crop-dialog"
      wide
      footer={
        <button className="btn primary" onClick={close}>
          Done
        </button>
      }
    >
      {t && meta && (
        <div className="editor-tabs">
          <Segmented<"crop" | "adjust">
            label="Image editor"
            value={tab}
            onChange={setTab}
            options={[
              { value: "crop", label: "Crop & rotate" },
              { value: "adjust", label: "Adjust" },
            ]}
          />
        </div>
      )}
      {stage ?? <p className="muted">Add an image first.</p>}
      {t && meta && tab === "crop" && (
        <>
          <div className="img-tools" role="toolbar" aria-label="Rotate and flip">
            <button
              type="button"
              className="btn sm"
              onClick={() => void reorient({ ...ops, rotate: ((ops.rotate + 270) % 360) as AssetOrigin["rotate"] })}
              disabled={busy}
            >
              <RotateCcw size={14} /> Rotate left
            </button>
            <button
              type="button"
              className="btn sm"
              onClick={() => void reorient({ ...ops, rotate: ((ops.rotate + 90) % 360) as AssetOrigin["rotate"] })}
              disabled={busy}
              data-testid="rotate-right"
            >
              <RotateCw size={14} /> Rotate right
            </button>
            <button type="button" className="btn sm" onClick={() => void reorient({ ...ops, flipH: !ops.flipH })} disabled={busy} data-testid="flip-h">
              <FlipHorizontal2 size={14} /> Flip
            </button>
            <button type="button" className="btn sm" onClick={() => void reorient({ ...ops, flipV: !ops.flipV })} disabled={busy} title="Flip vertically">
              <FlipVertical2 size={14} /> Flip ↕
            </button>
            <button type="button" className="btn sm" onClick={() => void autoFrame()} data-testid="auto-frame" title="Centre the subject">
              <ScanFace size={14} /> Auto-frame
            </button>
            <button type="button" className="btn sm" aria-pressed={grid} onClick={() => setGrid(!grid)} title="Rule-of-thirds grid">
              <Grid3x3 size={14} /> Grid
            </button>
          </div>
          {!t.fixedAspect && (
            <Field label="Crop">
              <Segmented
                label="Crop shape"
                value={String(t.aspect ? (ASPECTS.find((a) => Math.abs(Number(a.value) - t.aspect!) < 0.01)?.value ?? "0") : "0")}
                onChange={(v) => set({ aspect: v === "0" ? null : Number(v), crop: { x: 0, y: 0 } })}
                options={ASPECTS}
              />
            </Field>
          )}
          <Slider label="Zoom" unit="×" min={1} max={4} step={0.05} value={t.crop.zoom} onChange={(v) => set({ crop: { zoom: v } }, "zoom")} />
          <Slider
            label="Straighten"
            unit="°"
            min={-15}
            max={15}
            step={0.5}
            value={tilt ?? ops.straighten ?? 0}
            onChange={(v) => {
              setTilt(v);
              window.clearTimeout(tiltTimer.current);
              tiltTimer.current = window.setTimeout(() => void reorient({ ...ops, straighten: v || undefined }), 450);
            }}
          />
          <div className="row">
            <button className="btn sm ghost" onClick={() => set({ crop: { x: 0, y: 0, zoom: 1 } })}>
              Reset crop
            </button>
            {origin && (
              <button className="btn sm ghost" onClick={() => void reorient({ rotate: 0 })} disabled={busy}>
                <Undo2 size={14} /> Undo rotate &amp; flip
              </button>
            )}
          </div>
        </>
      )}
      {t && meta && tab === "adjust" && (
        <>
          <div className="presets" role="group" aria-label="Colour presets">
            {PRESETS.map((p) => presetThumb(p.value))}
          </div>
          {(look.preset === "duotone" || look.preset === "recolor") && (
            <div className="row" style={{ alignItems: "flex-start" }}>
              <ColorField label={look.preset === "duotone" ? "Shadows" : "Colour"} value={look.tone ?? accent} onChange={(c) => setLook({ tone: c }, "tone")} />
              {look.preset === "duotone" && <ColorField label="Highlights" value={look.tone2 ?? "#ffffff"} onChange={(c) => setLook({ tone2: c }, "tone2")} />}
            </div>
          )}
          <Slider label="Brightness" min={-100} max={100} value={look.brightness ?? 0} onChange={(v) => setLook({ brightness: v || undefined }, "b")} />
          <Slider label="Contrast" min={-100} max={100} value={look.contrast ?? 0} onChange={(v) => setLook({ contrast: v || undefined }, "c")} />
          <Slider label="Saturation" min={-100} max={100} value={look.saturation ?? 0} onChange={(v) => setLook({ saturation: v || undefined }, "s")} />
          <Slider label="Warmth" min={-100} max={100} value={look.warmth ?? 0} onChange={(v) => setLook({ warmth: v || undefined }, "w")} />
          <div className="row">
            <button
              className="btn sm ghost"
              onClick={() =>
                setLook({
                  brightness: undefined,
                  contrast: undefined,
                  saturation: undefined,
                  warmth: undefined,
                  preset: undefined,
                  tone: undefined,
                  tone2: undefined,
                })
              }
            >
              Reset colours
            </button>
          </div>
          <Field label="Background" hint="runs on this device">
            <div className="img-tools">
              <button type="button" className="btn sm" onClick={() => void removeBg("flat")} disabled={busy} data-testid="bg-flat">
                <Eraser size={14} /> Remove flat background
              </button>
              <button
                type="button"
                className="btn sm"
                onClick={() => void removeBg("person")}
                disabled={busy}
                title="The first time, this downloads the cut-out tool (about 10 MB). Your photo never leaves this device."
                data-testid="bg-person"
              >
                <UserRound size={14} /> Cut out person
              </button>
            </div>
          </Field>
          {(t.kind === "logo" || meta.mime === "image/png") && (
            <Field label="Logo tools" hint="for transparent logos">
              <div className="img-tools">
                <button type="button" className="btn sm" onClick={() => void trim()} disabled={busy} data-testid="trim-logo">
                  <Scissors size={14} /> Trim empty edges
                </button>
                <button type="button" className="btn sm" onClick={() => setLook({ preset: "recolor", tone: "#ffffff" })} data-testid="logo-white">
                  White version
                </button>
                <button type="button" className="btn sm" onClick={() => setLook({ preset: "recolor", tone: undefined })}>
                  Brand colour
                </button>
              </div>
            </Field>
          )}
        </>
      )}
    </Modal>
  );
}
