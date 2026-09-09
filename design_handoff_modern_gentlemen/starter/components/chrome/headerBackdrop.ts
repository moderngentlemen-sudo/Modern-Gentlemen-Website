/** Browser-local sampling of supported CSS colors and linear/radial gradients. */
export function sampleGradient(
  css: string,
  rect: DOMRect,
  x: number,
  y: number
): number[] | undefined {
  if (!/^(linear|radial)-gradient\(/.test(css)) return;
  const colors = [...css.matchAll(/((?:rgba?|color)\([^)]*\)|#[\da-f]{6,8})\s*(-?[\d.]+%)?/gi)];
  if (colors.length < 2) return;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  const px = x - rect.left,
    py = y - rect.top;
  let gradient: CanvasGradient;
  if (css.startsWith("linear")) {
    const direction = css.slice(css.indexOf("(") + 1, css.indexOf(",")).trim();
    const angles: Record<string, number> = {
      "to top": 0,
      "to right": 90,
      "to bottom": 180,
      "to left": 270,
    };
    const angle =
      ((direction.endsWith("deg") ? parseFloat(direction) : (angles[direction] ?? 180)) * Math.PI) /
      180;
    const dx = Math.sin(angle),
      dy = -Math.cos(angle),
      length = Math.abs(rect.width * dx) + Math.abs(rect.height * dy);
    gradient = ctx.createLinearGradient(
      rect.width / 2 - px - (dx * length) / 2,
      rect.height / 2 - py - (dy * length) / 2,
      rect.width / 2 - px + (dx * length) / 2,
      rect.height / 2 - py + (dy * length) / 2
    );
  } else {
    const center = css.match(/at\s+([\d.]+)%\s+([\d.]+)%/);
    const cx = rect.width * (center ? Number(center[1]) / 100 : 0.5),
      cy = rect.height * (center ? Number(center[2]) / 100 : 0.5);
    const radius = Math.max(Math.hypot(cx, cy), Math.hypot(rect.width - cx, rect.height - cy));
    gradient = ctx.createRadialGradient(cx - px, cy - py, 0, cx - px, cy - py, radius);
  }
  try {
    colors.forEach((m, i) =>
      gradient.addColorStop(
        Math.max(0, Math.min(1, m[2] ? parseFloat(m[2]) / 100 : i / (colors.length - 1))),
        m[1]
      )
    );
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1, 1);
    return [...ctx.getImageData(0, 0, 1, 1).data];
  } catch {
    return;
  }
}

const colorCache = new Map<string, number[]>();
/** Canvas resolves modern computed colors (including color-mix) into sRGB channels. */
export function sampleColor(value: string): number[] {
  const cached = colorCache.get(value);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [0, 0, 0, 0];
  ctx.fillStyle = value;
  ctx.fillRect(0, 0, 1, 1);
  const pixel = ctx.getImageData(0, 0, 1, 1).data;
  const result = [pixel[0], pixel[1], pixel[2], pixel[3] / 255];
  if (colorCache.size >= 128) colorCache.delete(colorCache.keys().next().value!);
  colorCache.set(value, result);
  return result;
}
