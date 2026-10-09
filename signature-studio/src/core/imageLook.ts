/**
 * How an image is framed and coloured: shape, border, ring, shadow, backing,
 * adjustments and colour presets. Pure — the editor preview (inline SVG) and
 * the publish pipeline (canvas) both draw from these numbers, so what you see
 * while editing is what recipients get:
 *
 *  - frame outlines are SVG path strings (the preview's <path>, the canvas's Path2D);
 *  - every colour change is one 4×5 colour matrix (the preview's feColorMatrix,
 *    the canvas's per-pixel pass), in sRGB, on unpremultiplied values.
 */

export type FrameShape = "square" | "rounded" | "circle" | "squircle" | "arch";
export type LookPreset = "none" | "mono" | "warm" | "cool" | "vivid" | "fade" | "sepia" | "duotone" | "recolor";

export interface ImageLook {
  /** Overrides the slot's legacy shape. */
  frame?: FrameShape;
  /** Corner radius for "rounded", in display px. */
  radius?: number;
  /** Border width in display px (drawn inside the frame). */
  border?: number;
  borderColor?: string;
  /** Space between the border and the image — a ring. */
  gap?: number;
  /** Soft drop shadow (adds a small margin around the image). */
  shadow?: boolean;
  /** Fill behind the image, inside the frame (for transparent logos, or a ring's gap). */
  backing?: string;
  /** Padding between the frame and the image, in display px. */
  inset?: number;
  /** -100…100 each. */
  brightness?: number;
  contrast?: number;
  saturation?: number;
  warmth?: number;
  preset?: LookPreset;
  /** Duotone shadows colour / one-colour logo colour. Defaults to the accent. */
  tone?: string;
  /** Duotone highlights colour. Defaults to a pale tint of `tone`. */
  tone2?: string;
}

export const FRAME_SHAPES: { value: FrameShape; label: string }[] = [
  { value: "square", label: "Square" },
  { value: "rounded", label: "Rounded" },
  { value: "squircle", label: "Squircle" },
  { value: "circle", label: "Circle" },
  { value: "arch", label: "Arch" },
];

export const PRESETS: { value: LookPreset; label: string }[] = [
  { value: "none", label: "Original" },
  { value: "mono", label: "B&W" },
  { value: "warm", label: "Warm" },
  { value: "cool", label: "Cool" },
  { value: "vivid", label: "Vivid" },
  { value: "fade", label: "Fade" },
  { value: "sepia", label: "Sepia" },
  { value: "duotone", label: "Brand duotone" },
  { value: "recolor", label: "One colour" },
];

/** Nothing to bake in beyond the legacy crop/shape. */
export function isPlainLook(l: ImageLook | undefined): boolean {
  if (!l) return true;
  return (
    (!l.frame || l.frame === "square" || l.frame === "circle" || (l.frame === "rounded" && l.radius === undefined)) &&
    !l.border &&
    !l.shadow &&
    !l.backing &&
    !l.inset &&
    !l.brightness &&
    !l.contrast &&
    !l.saturation &&
    !l.warmth &&
    (!l.preset || l.preset === "none")
  );
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

export interface FrameLayout {
  /** Whole output image (frame plus shadow margin). */
  W: number;
  H: number;
  /** Shadow margin on each side. */
  m: number;
  /** The frame box. */
  frame: { x: number; y: number; w: number; h: number; r: number };
  /** Where the image itself is drawn. */
  inner: { x: number; y: number; w: number; h: number; r: number };
}

export function shadowMargin(w: number): number {
  return Math.max(4, Math.round(Math.min(w, 400) * 0.06));
}

/** Corner radius a shape implies for a w×h frame. */
export function shapeRadius(shape: FrameShape, w: number, h: number, radius?: number): number {
  if (shape === "rounded") return Math.min(radius ?? Math.round(w * 0.12), w / 2, h / 2);
  if (shape === "squircle") return Math.min(w, h) * 0.5;
  if (shape === "arch") return Math.min(w / 2, h);
  if (shape === "circle") return Math.min(w, h) / 2;
  return 0;
}

export function frameLayout(look: ImageLook, shape: FrameShape, w: number, h: number): FrameLayout {
  const m = look.shadow ? shadowMargin(w) : 0;
  const r = shapeRadius(shape, w, h, look.radius);
  const pad = Math.max(0, (look.border ?? 0) + (look.gap ?? 0) + (look.inset ?? 0));
  const iw = Math.max(1, w - pad * 2);
  const ih = Math.max(1, h - pad * 2);
  // Concentric corners: the inner radius shrinks by the padding (circles and arches follow their own size).
  const ir = shape === "rounded" ? Math.max(0, r - pad) : shapeRadius(shape, iw, ih, look.radius);
  return { W: w + m * 2, H: h + m * 2, m, frame: { x: m, y: m, w, h, r }, inner: { x: m + pad, y: m + pad, w: iw, h: ih, r: ir } };
}

const n = (v: number) => (Math.round(v * 100) / 100).toString();

/** The frame outline as an SVG path (also valid for `new Path2D`). */
export function framePath(shape: FrameShape, x: number, y: number, w: number, h: number, r: number): string {
  if (shape === "circle") {
    const rx = w / 2;
    const ry = h / 2;
    return `M${n(x)} ${n(y + ry)}A${n(rx)} ${n(ry)} 0 1 1 ${n(x + w)} ${n(y + ry)}A${n(rx)} ${n(ry)} 0 1 1 ${n(x)} ${n(y + ry)}Z`;
  }
  if (shape === "squircle") {
    // Superellipse |x|^4 + |y|^4 = 1, sampled — the iOS-icon corner.
    const pts: string[] = [];
    const steps = 72;
    for (let i = 0; i < steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const c = Math.cos(t);
      const s = Math.sin(t);
      const px = x + w / 2 + (w / 2) * Math.sign(c) * Math.sqrt(Math.abs(c));
      const py = y + h / 2 + (h / 2) * Math.sign(s) * Math.sqrt(Math.abs(s));
      pts.push(`${i ? "L" : "M"}${n(px)} ${n(py)}`);
    }
    return pts.join("") + "Z";
  }
  if (shape === "arch") {
    const rr = Math.min(w / 2, h);
    return `M${n(x)} ${n(y + h)}L${n(x)} ${n(y + rr)}A${n(rr)} ${n(rr)} 0 0 1 ${n(x + rr)} ${n(y)}L${n(x + w - rr)} ${n(y)}A${n(rr)} ${n(rr)} 0 0 1 ${n(x + w)} ${n(y + rr)}L${n(x + w)} ${n(y + h)}Z`;
  }
  const rr = shape === "rounded" ? Math.max(0, Math.min(r, w / 2, h / 2)) : 0;
  if (!rr) return `M${n(x)} ${n(y)}H${n(x + w)}V${n(y + h)}H${n(x)}Z`;
  return (
    `M${n(x + rr)} ${n(y)}H${n(x + w - rr)}A${n(rr)} ${n(rr)} 0 0 1 ${n(x + w)} ${n(y + rr)}V${n(y + h - rr)}` +
    `A${n(rr)} ${n(rr)} 0 0 1 ${n(x + w - rr)} ${n(y + h)}H${n(x + rr)}A${n(rr)} ${n(rr)} 0 0 1 ${n(x)} ${n(y + h - rr)}` +
    `V${n(y + rr)}A${n(rr)} ${n(rr)} 0 0 1 ${n(x + rr)} ${n(y)}Z`
  );
}

/**
 * Extra zoom so a picture rotated by `deg` still covers its original box
 * (no empty corners when straightening).
 */
export function straightenScale(w: number, h: number, deg: number): number {
  const t = (Math.abs(deg) * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  return Math.max((w * c + h * s) / w, (w * s + h * c) / h);
}

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

/** Row-major 4×5 matrix on 0…1 channels: [r g b a 1] → [r g b a]. */
export type ColorMatrix = number[];

const IDENTITY: ColorMatrix = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];

/** a ∘ b: apply `b` first, then `a`. */
export function compose(a: ColorMatrix, b: ColorMatrix): ColorMatrix {
  const out: number[] = [];
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 5; c++) {
      let v = c === 4 ? a[r * 5 + 4] : 0;
      for (let k = 0; k < 4; k++) v += a[r * 5 + k] * b[k * 5 + c];
      out.push(v);
    }
  return out;
}

const LUM = [0.2126, 0.7152, 0.0722];

function saturate(s: number): ColorMatrix {
  const [lr, lg, lb] = LUM;
  return [
    lr + (1 - lr) * s,
    lg - lg * s,
    lb - lb * s,
    0,
    0,
    lr - lr * s,
    lg + (1 - lg) * s,
    lb - lb * s,
    0,
    0,
    lr - lr * s,
    lg - lg * s,
    lb + (1 - lb) * s,
    0,
    0,
    0,
    0,
    0,
    1,
    0,
  ];
}

const scale = (k: number, off = 0): ColorMatrix => [k, 0, 0, 0, off, 0, k, 0, 0, off, 0, 0, k, 0, off, 0, 0, 0, 1, 0];
const shift = (r: number, g: number, b: number): ColorMatrix => [1, 0, 0, 0, r, 0, 1, 0, 0, g, 0, 0, 1, 0, b, 0, 0, 0, 1, 0];

function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.replace(/./g, "$&$&") : h.padEnd(6, "0").slice(0, 6);
  return [parseInt(full.slice(0, 2), 16) / 255, parseInt(full.slice(2, 4), 16) / 255, parseInt(full.slice(4, 6), 16) / 255];
}

/** Luminance mapped onto a gradient from `dark` to `light`. */
function duotone(dark: string, light: string): ColorMatrix {
  const a = rgb(dark);
  const b = rgb(light);
  const row = (i: number) => [...LUM.map((l) => l * (b[i] - a[i])), 0, a[i]];
  return [...row(0), ...row(1), ...row(2), 0, 0, 0, 1, 0];
}

/** Every visible pixel becomes `color`; transparency is kept. */
function recolor(color: string): ColorMatrix {
  const [r, g, b] = rgb(color);
  return [0, 0, 0, 0, r, 0, 0, 0, 0, g, 0, 0, 0, 0, b, 0, 0, 0, 1, 0];
}

const SEPIA: ColorMatrix = [0.393, 0.769, 0.189, 0, 0, 0.349, 0.686, 0.168, 0, 0, 0.272, 0.534, 0.131, 0, 0, 0, 0, 0, 1, 0];

/** Pale tint of a colour, the default duotone highlight. */
export function paleTint(hex: string): string {
  const [r, g, b] = rgb(hex);
  const h = (v: number) =>
    Math.round((v + (1 - v) * 0.88) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** The single colour matrix for a look, or null when colours are untouched. */
export function lookMatrix(look: ImageLook | undefined, accent = "#000000"): ColorMatrix | null {
  if (!look) return null;
  let m = IDENTITY;
  let touched = false;
  const then = (x: ColorMatrix) => {
    m = compose(x, m);
    touched = true;
  };
  const b = (look.brightness ?? 0) / 100;
  const c = (look.contrast ?? 0) / 100;
  const s = (look.saturation ?? 0) / 100;
  const w = (look.warmth ?? 0) / 100;
  if (b) then(scale(1 + b * 0.5));
  if (c) {
    const k = 1 + c * 0.6;
    then(scale(k, 0.5 * (1 - k)));
  }
  if (s) then(saturate(Math.max(0, 1 + s)));
  if (w) then(shift(w * 0.08, w * 0.02, -w * 0.08));
  const tone = look.tone ?? accent;
  switch (look.preset ?? "none") {
    case "mono":
      then(saturate(0));
      break;
    case "warm":
      then(shift(0.05, 0.015, -0.05));
      then(saturate(1.1));
      break;
    case "cool":
      then(shift(-0.04, 0.005, 0.05));
      break;
    case "vivid":
      then(saturate(1.4));
      then(scale(1.12, -0.06));
      break;
    case "fade":
      then(saturate(0.8));
      then(scale(0.82, 0.12));
      break;
    case "sepia":
      then(SEPIA);
      break;
    case "duotone":
      then(duotone(tone, look.tone2 ?? paleTint(tone)));
      break;
    case "recolor":
      then(recolor(tone));
      break;
  }
  return touched ? m : null;
}

/** Apply a colour matrix to RGBA pixel data in place. */
export function applyMatrix(data: Uint8ClampedArray, m: ColorMatrix): void {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    const a = data[i + 3] / 255;
    data[i] = (m[0] * r + m[1] * g + m[2] * b + m[3] * a + m[4]) * 255;
    data[i + 1] = (m[5] * r + m[6] * g + m[7] * b + m[8] * a + m[9]) * 255;
    data[i + 2] = (m[10] * r + m[11] * g + m[12] * b + m[13] * a + m[14]) * 255;
    data[i + 3] = (m[15] * r + m[16] * g + m[17] * b + m[18] * a + m[19]) * 255;
  }
}

/** feColorMatrix `values` attribute. */
export const matrixValues = (m: ColorMatrix) => m.map((v) => +v.toFixed(4)).join(" ");

/** A short, stable key for a look (part of the published image's cache key). */
export function lookKey(look: ImageLook | undefined, accent: string): string {
  if (isPlainLook(look)) return "";
  const l = look!;
  const m = lookMatrix(l, accent);
  return [
    l.frame ?? "",
    l.radius ?? "",
    l.border ?? "",
    l.border ? (l.borderColor ?? "") : "",
    l.gap ?? "",
    l.shadow ? "s" : "",
    l.backing ?? "",
    l.inset ?? "",
    m ? m.map((v) => v.toFixed(3)).join(",") : "",
  ].join(";");
}

/** djb2 — short ids for SVG defs in the preview. */
export function shortHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Look fields a legacy shape implies, so old documents open with the right frame selected. */
export function effectiveFrame(look: ImageLook | undefined, legacy: "square" | "rounded" | "circle"): FrameShape {
  return look?.frame ?? legacy;
}
